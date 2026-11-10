"use server";

import { createCipheriv, createHmac, randomBytes, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { siteOrigin } from "@/lib/catalog";
import { applicationSchema, couponCode, email, errorMessage, optText, safePath, text, toKobo, uuid, type FormState } from "@/lib/forms";
import { notifyContactEnquiry, sendMail } from "@/lib/mail";
import { METHODS } from "@/lib/model";
import { checkoutAvailable, checkoutLinkExpiry, initialiseCheckout, logFlutterwave, PaymentError, paymentSiteOrigin } from "@/lib/payments";
import { privilegedDb, requireStudent, serverDb } from "@/lib/supabase";

const credentials = z.object({ email, password: z.string().min(8, "Use at least eight characters.").max(128) });
const raw = (form: FormData, key: string) => String(form.get(key) ?? "");

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: errorMessage(parsed) };
  const db = await serverDb();
  if (!db) return { error: "Account access is being configured." };
  const { error } = await db.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Sign-in failed. Check your password and confirm your email address." };
  redirect(safePath(raw(form, "next")));
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.extend({ full_name: text("your full name", 100, 2) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: errorMessage(parsed) };
  const db = await serverDb();
  if (!db) return { error: "Account access is being configured." };
  const next = safePath(raw(form, "next"));
  const { email, password, full_name } = parsed.data;
  const { data, error } = await db.auth.signUp({
    email, password, options: { data: { full_name },
      emailRedirectTo: `${siteOrigin()}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  if (error) return { error: "We couldn’t create the account. Try again later or sign in if you already registered." };
  if (data.session) redirect(next);
  return { success: "Check your email for a confirmation link. Once confirmed, sign in to continue." };
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const parsed = email.safeParse(raw(form, "email"));
  if (!parsed.success) return { error: errorMessage(parsed) };
  const db = await serverDb();
  if (!db) return { error: "Account access is being configured." };
  await db.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${siteOrigin()}/auth/confirm?next=/account/update` });
  return { success: "If the email is registered, you’ll receive a password reset link." };
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStudent("/account/update");
  const password = z.string().min(8, "Use at least eight characters.").max(128).safeParse(raw(form, "password"));
  if (!password.success) return { error: errorMessage(password) };
  const { error } = await db.auth.updateUser({ password: password.data });
  if (error) return { error: "Could not update the password. Reopen your reset link and try again." };
  redirect("/dashboard");
}

export async function signOut() {
  const db = await serverDb();
  await db?.auth.signOut();
  redirect("/");
}

function encryptNin(nin: string) {
  const key = Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const bytes = Buffer.concat([cipher.update(nin, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), bytes.toString("base64url")].join(".");
}

export async function submitApplication(_: FormState, form: FormData): Promise<FormState> {
  const { db, user } = await requireStudent();
  const parsed = applicationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: errorMessage(parsed) };
  if (!user.email || !user.email_confirmed_at) return { error: "Confirm your email before applying." };
  const p = parsed.data;
  const { data: course } = await db.from("courses").select("id,title,identity_requested")
    .eq("id", p.course_id).eq("published", true).eq("archived", false).maybeSingle();
  if (!course) return { error: "This course is unavailable." };
  const { data: previous } = await db.from("applications").select("id")
    .eq("course_id", p.course_id).eq("user_id", user.id).neq("status", "rejected").maybeSingle();
  if (previous) redirect(`/dashboard/applications/${previous.id}`);
  const upload = form.get("photo");
  const photo = upload instanceof File && upload.size ? upload : null;
  if ((p.nin || photo) && (!course.identity_requested || p.identity_consent !== "on")) {
    return { error: "Identity evidence is optional and requires separate consent when the centre requests it." };
  }
  const encrypted = p.nin ? encryptNin(p.nin) : null;
  if (p.nin && !encrypted) return { error: "Use the centre’s secure verification process for your NIN." };
  let path: string | null = null;
  if (photo) {
    if (photo.size > 2_097_152 || !["image/png", "image/jpeg"].includes(photo.type)) {
      return { error: "Upload a JPEG or PNG passport photo up to 2 MB." };
    }
    const bytes = Buffer.from(await photo.arrayBuffer());
    const valid = photo.type === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
      : bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"));
    if (!valid) return { error: "The file does not match its image format." };
    path = `${user.id}/${randomUUID()}.${photo.type === "image/png" ? "png" : "jpg"}`;
    const uploaded = await db.storage.from("applicant-photos").upload(path, bytes, { contentType: photo.type });
    if (uploaded.error) return { error: "The photo could not be uploaded. Try again or contact the centre." };
  }
  const { nin: _nin, course_id: _course, ...fields } = p;
  const { data, error } = await db.rpc("submit_application", {
    p_course: p.course_id,
    p_data: { ...fields, photo_path: path, nin_ciphertext: encrypted, identity_consent: p.identity_consent === "on",
      rules: true, terms: true, privacy: true, refund: true },
  }).single<{ id: string; reference: string; payable_kobo: number }>();
  if (path) {
    const attached = await db.rpc("photo_attached", { path });
    if (!attached.error && !attached.data) await db.storage.from("applicant-photos").remove([path]);
  }
  if (error || !data) return { error: error?.code === "P0001" ? error.message : "Your application could not be saved. Please check your details and try again." };
  const recipient = user.email;
  after(() => sendMail(recipient, "Obsidian Research application received",
    `We received your application for ${course.title}. Your reference is ${data.reference}. View your progress at ${siteOrigin()}/dashboard.`));
  if (p.payment_method === "flutterwave" && data.payable_kobo > 0) {
    const path = `/dashboard/applications/${data.id}?submitted=1`;
    if (!await checkoutAvailable()) redirect(path);
    const checkout = await prepareCheckout(db, user.id, recipient, data.id, null);
    if ("url" in checkout) redirect(checkout.url);
    redirect(`${path}&payment=checkout_retry`);
  }
  redirect(`/dashboard/applications/${data.id}?submitted=1`);
}

export async function checkRegistrationCoupon(course: string, input: string) {
  const { db } = await requireStudent();
  const id = uuid.safeParse(course);
  const code = couponCode.safeParse(input);
  if (!id.success || !code.success || !code.data) return { error: "Enter a valid coupon code." };
  const { data, error } = await db.rpc("quote_registration_coupon", { p_course: id.data, p_code: code.data })
    .maybeSingle<{ discount_kobo: number; payable_kobo: number }>();
  if (error) return { error: "Could not check the coupon. Try again." };
  if (!data) return { error: "This coupon is unavailable for your application." };
  return { discount: data.discount_kobo, payable: data.payable_kobo };
}

export async function choosePayment(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ id: uuid, method: z.enum(METHODS), reference: optText(120) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: errorMessage(parsed) };
  const { db } = await requireStudent();
  const { id, method, reference } = parsed.data;
  const { error } = await db.rpc("choose_payment", { p_id: id, p_method: method, p_reference: reference });
  if (error) return { error: error.code === "P0001" ? error.message : "Could not update the payment option." };
  revalidatePath(`/dashboard/applications/${id}`);
  return { success: "Payment preference saved." };
}

export async function startCheckout(_: FormState, form: FormData): Promise<FormState> {
  const { db, user } = await requireStudent();
  if (!await checkoutAvailable()) return { error: "Online checkout is being configured. You can choose cash or bank transfer." };
  const id = uuid.safeParse(raw(form, "id"));
  const amountText = raw(form, "amount");
  const amount = amountText ? toKobo(amountText) : null;
  if (!id.success || (amountText && amount === null) || !user.email) return { error: "Enter a valid payment amount." };
  const checkout = await prepareCheckout(db, user.id, user.email, id.data, amount);
  if ("url" in checkout) redirect(checkout.url);
  return checkout;
}

async function prepareCheckout(db: Awaited<ReturnType<typeof requireStudent>>["db"], userId: string,
  email: string, id: string, amount: number | null): Promise<{ url: string } | { error: string }> {
  const { data: application } = await db.from("applications").select("full_name")
    .eq("id", id).eq("user_id", userId).maybeSingle();
  if (!application) return { error: "Application not found." };
  const { data, error } = await db.rpc("begin_checkout", { p_id: id, p_amount: amount })
    .single<{ id: string; reference: string; amount_kobo: number; checkout_url: string | null; created: boolean }>();
  if (error || !data) return { error: error?.code === "P0001" ? error.message : "Could not start checkout." };
  if (amount !== null && Number(data.amount_kobo) !== amount) {
    return { error: "An online checkout is already open for a different amount. Complete it or wait for it to expire." };
  }
  const reservation = await db.from("payments").select("checkout_expires_at,checkout_url,status").eq("id",data.id).maybeSingle();
  const expiresAt = checkoutLinkExpiry(reservation.data?.checkout_expires_at ?? "");
  if (reservation.error || !Number.isFinite(expiresAt)) return { error: "Could not confirm the checkout window. Please try again." };
  if (reservation.data?.status !== "pending") return { error: "This checkout is closed. Refresh the application to see your balance." };
  if (Date.now() >= expiresAt) return { error: "The checkout link has expired. Allow up to 15 minutes for payment confirmation before trying again." };
  if (reservation.data?.checkout_url?.startsWith("https://checkout.flutterwave.com/")) return { url: reservation.data.checkout_url };
  if (!data.created) return { error: "A checkout is being prepared. Refresh this page shortly. Contact the centre if it remains pending." };
  let link: string;
  try {
    const returnOrigin = paymentSiteOrigin((await headers()).get("host"));
    link = await initialiseCheckout({ reference: data.reference, amountKobo: data.amount_kobo, expiresAt,
      email, name: application.full_name, returnOrigin });
    const admin = privilegedDb();
    const saved = await admin?.from("payments").update({ checkout_url: link }).eq("id", data.id)
      .eq("status", "pending").select("id").maybeSingle();
    if (saved?.error || !saved?.data) throw new PaymentError("provider", "Checkout could not be recorded.");
  } catch (error) {
    await logFlutterwave("checkout_unavailable", "checkout", data.reference);
    return { error: error instanceof PaymentError ? error.message : "The payment provider is temporarily unavailable. Contact the centre if needed." };
  }
  await logFlutterwave("checkout_ready", "checkout", data.reference);
  return { url: link };
}

export async function contactEnquiry(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ full_name: text("your name", 100, 2), email,
    topic: text("a topic", 120, 2), message: text("a message", 2000, 10) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: errorMessage(parsed) };
  if (raw(form, "fax")) return { success: "Your enquiry was received." };
  const db = privilegedDb();
  const secret = process.env.CONTACT_RATE_LIMIT_SECRET;
  if (!db || !secret) return { error: "The enquiry inbox is being configured. Call or WhatsApp the centre for assistance." };
  const h = await headers();
  const ip = process.env.VERCEL === "1" ? h.get("x-vercel-forwarded-for")?.trim() ?? "" : "";
  const source = isIP(ip) ? ip : "unproxied";
  const { full_name, email: address, topic, message } = parsed.data;
  const { data: id, error } = await db.rpc("record_enquiry", { p_name: full_name, p_email: address, p_topic: topic,
    p_message: message, p_hash: createHmac("sha256", secret).update(source).digest("hex") });
  if (error || typeof id !== "string") return { error: error?.code === "P0001" ? error.message : "Could not send the enquiry. Please try again." };
  after(() => notifyContactEnquiry(id).then(() => undefined));
  revalidatePath("/admin/enquiries");
  return { success: "Your enquiry was received. The centre can reply to the email you provided." };
}
