"use server";

import { createDecipheriv, randomUUID, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { couponCode, errorMessage, optText, optionalDate, optionalUuid, text, toKobo, uuid, type FormState } from "@/lib/forms";
import { editorialImage } from "@/lib/editorial";
import { CONTENT, FINANCE, OPERATIONS, ROLES, STATUSES } from "@/lib/model";
import { PaymentError, verifyFlutterwave } from "@/lib/payments";
import { requireStaff } from "@/lib/supabase";
import { SOLAR_RATES, SOLAR_SERVICE } from "@/lib/solar";

const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const isChecked = (form: FormData, name: string) => form.get(name) === "on";
const lines = (value: string) => value.split(/\r?\n/).map((v) => v.trim()).filter(Boolean).slice(0,20);
const slug = z.string().trim().min(2).max(90).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens for the slug.");
const kinds = ["company","service","announcement","testimonial","faq","promotion","article"] as const;
const message = (error: { code?: string; message: string }, fallback: string): FormState =>
  ({ error: error.code === "P0001" ? error.message : error.code === "23505" ? "That value is already in use." : fallback });

function lagosDateTime(value: string) {
  if (!value) return null;
  const parsed = z.iso.datetime({ local: true }).safeParse(value);
  return parsed.success && !/[Z+-]\d{2}:?\d{2}$/.test(value) && !value.endsWith("Z") ? `${value}+01:00` : undefined;
}

export async function saveCourse(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStaff(OPERATIONS);
  const schema = z.object({
    id: optionalUuid, slug, title: text("a course title",150), category: text("a category",90),
    summary: text("a summary",400), description: optText(8000), objectives: optText(2000), requirements: optText(2500),
    schedule: optText(2500), faq: optText(2500), accent: z.enum(["blue","gold"]),
    mode: z.enum(["","physical","online","hybrid"]), duration: optText(80),
    starts_at: optionalDate, phase: z.enum(["upcoming","starting_soon","running","completed"]),
    cover_url: optText(500),
  });
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: errorMessage(parsed) };
  const { id, starts_at, duration, mode, objectives, cover_url, ...values } = parsed.data;
  const fee = toKobo(field(form,"fee"));
  const installmentText = field(form,"installment");
  const installment = installmentText ? toKobo(installmentText) : null;
  const capacityText = field(form,"capacity");
  const capacity = capacityText ? Number(capacityText) : null;
  const deadline = lagosDateTime(field(form,"deadline"));
  if (fee === null || fee > 5_000_000_000) return { error: "Enter a valid registration fee in naira." };
  if (installmentText && (!installment || installment > fee)) return { error: "The minimum installment must be above zero and at most the fee." };
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 100_000)) return { error: "Enter a positive course capacity." };
  if (deadline === undefined) return { error: "Enter a valid registration deadline." };
  let cover = cover_url || null;
  if (cover && !/^\/media\/[a-z-]+\.webp$/.test(cover)) {
    try {
      const url = new URL(cover);
      if (url.origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.invalid").origin ||
        !url.pathname.startsWith("/storage/v1/object/public/course-media/")) return { error: "Use a course media image from this project." };
    } catch { return { error: "Invalid course cover." }; }
  }
  const image = form.get("cover");
  let uploadedPath: string | null = null;
  if (image instanceof File && image.size) {
    const types: Record<string,string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
    const type = types[image.type];
    if (!type || image.size > 2_097_152) return { error: "Upload a JPEG, PNG or WebP cover up to 2 MB." };
    const buffer = Buffer.from(await image.arrayBuffer());
    const valid = type === "png" ? buffer.subarray(0,8).toString("hex")==="89504e470d0a1a0a"
      : type === "jpg" ? buffer.subarray(0,3).toString("hex")==="ffd8ff"
      : buffer.subarray(0,4).toString()==="RIFF" && buffer.subarray(8,12).toString()==="WEBP";
    if (!valid) return { error: "The cover does not match the image format." };
    uploadedPath = `${randomUUID()}.${type}`;
    const uploaded = await db.storage.from("course-media").upload(uploadedPath,buffer,{ contentType:image.type,cacheControl:"86400" });
    if (uploaded.error) return { error: "Could not upload the cover image." };
    cover = db.storage.from("course-media").getPublicUrl(uploadedPath).data.publicUrl;
  }
  const payload = { ...values, starts_at: starts_at || null, duration: duration || null, mode: mode || null,
    objectives: lines(objectives), cover_url: cover, capacity, registration_deadline: deadline, fee_kobo: fee,
    installment_min_kobo: installment, identity_requested: isChecked(form,"identity_requested"),
    published: isChecked(form,"published"), registrations_open: isChecked(form,"registrations_open") };
  const result = await (id ? db.from("courses").update({ ...payload, updated_at: new Date().toISOString() }).eq("id",id)
    : db.from("courses").insert(payload)).select("id").single();
  if (result.error || !result.data) {
    if (uploadedPath) await db.storage.from("course-media").remove([uploadedPath]);
    return result.error ? message(result.error,"Could not save this course.") : { error: "Course could not be saved." };
  }
  revalidatePath("/", "layout");
  if (!id) redirect(`/admin/courses/${result.data.id}`);
  return { success: "Course saved." };
}

export async function archiveCourse(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStaff(OPERATIONS);
  const id = uuid.safeParse(field(form,"id"));
  if (!id.success) return { error: "Invalid course." };
  const archived = field(form,"archived") === "true";
  const { data, error } = await db.from("courses").update({ archived, published:false, registrations_open:false,
    updated_at: new Date().toISOString() }).eq("id",id.data).select("id").single();
  if (error || !data) return { error: "Could not change the archive status." };
  revalidatePath("/", "layout");
  return { success: archived ? "Course archived. Existing enrolments remain accessible." : "Course restored as an unpublished draft." };
}

export async function saveModule(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStaff(OPERATIONS);
  const parsed = z.object({ id: optionalUuid, course_id: uuid, position: z.coerce.number().int().min(1).max(500),
    title: text("a module title",200), description: optText(2000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: errorMessage(parsed) };
  const { id, ...values } = parsed.data;
  const query = id ? db.from("course_modules").update(values).eq("id",id).eq("course_id",values.course_id)
    : db.from("course_modules").insert(values);
  const { error } = await query.select("id").single();
  if (error) return message(error,"Could not save the module.");
  revalidatePath("/", "layout");
  return { success: "Module saved." };
}

export async function removeModule(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStaff(OPERATIONS);
  const id = uuid.safeParse(field(form,"id"));
  if (!id.success) return { error: "Invalid module." };
  const { error } = await db.from("course_modules").delete().eq("id",id.data).select("id").single();
  if (error) return { error: "Could not remove the module." };
  revalidatePath("/", "layout");
  return { success: "Module removed." };
}

export async function saveBatch(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStaff(OPERATIONS);
  const parsed = z.object({ id: optionalUuid, course_id: uuid, name: text("a batch name",100),
    starts_at: optionalDate, schedule: optText(2000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: errorMessage(parsed) };
  const { id, starts_at, ...batch } = parsed.data;
  const values = { ...batch, starts_at: starts_at || null, accepting: isChecked(form,"accepting") };
  const query = id ? db.from("course_batches").update(values).eq("id",id).eq("course_id",batch.course_id)
    : db.from("course_batches").insert(values);
  const { error } = await query.select("id").single();
  if (error) return message(error,"Could not save the batch.");
  revalidatePath("/", "layout");
  return { success: "Batch saved." };
}

export async function saveDiscount(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStaff(OPERATIONS);
  const parsed = z.object({ id: optionalUuid, course_id: uuid, label: text("a promotion label",100),
    kind: z.enum(["percent","fixed"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: errorMessage(parsed) };
  const p = parsed.data;
  const value = p.kind === "percent" ? Number(field(form,"value")) : toKobo(field(form,"value"));
  const limit = field(form,"limit") ? Number(field(form,"limit")) : null;
  const starts = lagosDateTime(field(form,"starts"));
  const ends = lagosDateTime(field(form,"ends"));
  const code = couponCode.safeParse(field(form,"coupon_code"));
  if (!code.success) return { error: errorMessage(code) };
  if (code.data && (limit === null || !ends)) return { error: "Set an expiry and a usage limit for the coupon." };
  if (!value || !Number.isSafeInteger(value) || value<1 || value>(p.kind==="percent" ? 100 : 5_000_000_000)) return { error: "Enter a valid percentage or fixed naira discount." };
  if (limit !== null && (!Number.isInteger(limit) || limit<1 || limit>100_000)) return { error: "Enter a positive eligibility limit or leave it blank." };
  if (starts===undefined || ends===undefined || (starts && ends && Date.parse(ends)<=Date.parse(starts))) return { error: "Enter a valid offer period." };
  const { error } = await db.rpc("save_discount", { p_course:p.course_id,p_id:p.id || null,p_label:p.label,
    p_kind:p.kind,p_value:value,p_limit:limit,p_start:starts,p_end:ends,p_active:isChecked(form,"active"),p_code:code.data || null });
  if (error) return message(error,"Could not save the promotion.");
  revalidatePath("/", "layout");
  return { success: "Promotion saved." };
}

export async function reviewApplication(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStaff(OPERATIONS);
  const parsed = z.object({ id:uuid,status:z.enum(STATUSES),batch:optionalUuid,note:optText(2000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: errorMessage(parsed) };
  const { id,status,batch,note } = parsed.data;
  const { error } = await db.rpc("review_application",{ p_id:id,p_status:status,p_batch:batch || null,p_note:note });
  if (error) return message(error,"Could not update the application.");
  revalidatePath("/admin","layout");
  return { success: "Application updated." };
}

export async function reviewIdentity(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStaff(OPERATIONS);
  const parsed = z.object({ id:uuid,status:z.enum(["verified","needs_review"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: errorMessage(parsed) };
  const { error } = await db.rpc("review_identity",{ p_id:parsed.data.id,p_status:parsed.data.status });
  if (error) return message(error,"Could not record identity review.");
  revalidatePath(`/admin/applications/${parsed.data.id}`);
  return { success: "Identity review recorded." };
}

export async function compareIdentityNumber(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStaff(OPERATIONS);
  const parsed = z.object({ id:uuid,nin:z.string().regex(/^[0-9]{11}$/) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error:"Enter the 11-digit NIN from the document you verified." };
  const { data } = await db.from("application_identity").select("nin_ciphertext")
    .eq("application_id",parsed.data.id).maybeSingle();
  const key = Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY ?? "", "base64");
  if (!data?.nin_ciphertext || key.length !== 32) return { error:"Use the centre’s approved identity verification process." };
  let matches = false;
  try {
    const [version, iv, tag, ciphertext] = data.nin_ciphertext.split(".");
    if (version !== "v1") throw new Error("Invalid ciphertext version");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv,"base64url"));
    decipher.setAuthTag(Buffer.from(tag,"base64url"));
    const actual = Buffer.concat([decipher.update(Buffer.from(ciphertext,"base64url")),decipher.final()]);
    const expected = Buffer.from(parsed.data.nin,"utf8");
    matches = actual.length === expected.length && timingSafeEqual(actual,expected);
    actual.fill(0);
    expected.fill(0);
  } catch { return { error:"The stored identity number could not be compared." }; }
  const { error } = await db.rpc("review_identity",{ p_id:parsed.data.id,p_status:matches ? "verified" : "needs_review" });
  if (error) return { error:"Could not save the verification result." };
  revalidatePath(`/admin/applications/${parsed.data.id}`);
  return matches ? { success:"Identity number matched. Verification recorded." } : { error:"The number did not match. The application needs identity review." };
}

export async function updateEnrollment(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStaff(OPERATIONS);
  const parsed = z.object({ id:uuid,status:z.enum(["active","completed","withdrawn"]),batch:optionalUuid }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: errorMessage(parsed) };
  const { id,status,batch } = parsed.data;
  const { error } = await db.from("enrollments").update({ status, batch_id:batch || null }).eq("id",id).select("id").single();
  if (error) return message(error,"Could not update the enrolment.");
  revalidatePath("/admin/students");
  return { success: "Enrolment updated." };
}

export async function recordPayment(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStaff(FINANCE);
  const parsed = z.object({ id:uuid,method:z.enum(["cash","transfer"]),reference:text("the verified payment reference",160) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: errorMessage(parsed) };
  const amount = toKobo(field(form,"amount"));
  if (!amount) return { error: "Enter a valid received amount in naira." };
  const { error } = await db.rpc("record_manual_payment",{ p_id:parsed.data.id,p_method:parsed.data.method,
    p_amount:amount,p_reference:parsed.data.reference });
  if (error) return message(error,"Could not record the payment.");
  revalidatePath("/admin/finance");
  return { success: "Payment recorded and receipt issued." };
}

export async function reconcilePayment(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStaff(FINANCE);
  const parsed = z.object({ reference:z.string().regex(/^ORP-[a-f0-9]{32}$/),transaction:z.string().regex(/^\d{1,30}$/) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter a valid checkout reference and Flutterwave transaction ID." };
  const { data: payment } = await db.from("payments").select("id").eq("reference",parsed.data.reference).eq("method","flutterwave").maybeSingle();
  if (!payment) return { error: "Checkout reference not found." };
  try { await verifyFlutterwave(parsed.data.transaction,parsed.data.reference); }
  catch (error) { return { error: error instanceof PaymentError ? error.message : "Verification could not be completed." }; }
  revalidatePath("/admin/finance");
  return { success: "Flutterwave verified the payment. Receipt issued." };
}

export async function saveContent(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStaff(CONTENT);
  const parsed = z.object({ id:optionalUuid,kind:z.enum(kinds),slug,title:text("a title",160),
    summary:optText(600),body:optText(40000),position:z.coerce.number().int().min(0).max(1000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: errorMessage(parsed) };
  const { id, ...values } = parsed.data;
  if (values.kind !== "article" && values.body.length > 8000) return { error: "Keep this content under 8,000 characters." };
  let details: Record<string,unknown> = {};
  if (values.kind==="company") {
    const companyFields = z.object({
      tagline:optText(160),mission:optText(600),vision:optText(600),phone:z.string().regex(/^\+[0-9 ()-]{7,24}$/),
      email:z.union([z.literal(""),z.email()]),website:z.url({ protocol:/^https$/ }),address:text("an address",300),
      banner:optText(250),
    }).safeParse(Object.fromEntries(form));
    if (!companyFields.success) return { error: errorMessage(companyFields) };
    details = companyFields.data;
  } else if (values.kind==="service") {
    details = { offerings:lines(field(form,"offerings").slice(0,1800)),benefits:lines(field(form,"benefits").slice(0,1800)) };
    const price = field(form, "service_price");
    if (price) {
      const kobo = toKobo(price);
      if (kobo === null || kobo > 5_000_000_000) return { error: "Enter a valid service price in naira." };
      details.price_kobo = kobo;
    }
    if (values.slug === SOLAR_SERVICE && isChecked(form,"solar_pricing")) {
      const prices: Record<string, number> = {};
      for (const { key, label } of SOLAR_RATES) {
        const amount = toKobo(field(form,`solar_price_${key}`));
        if (amount === null || amount > 5_000_000_000) return { error: `Enter a valid price in naira for ${label}.` };
        prices[key] = amount;
      }
      details.solar_prices = prices;
    }
  } else if (values.kind==="article") {
    const cover = field(form,"cover_url");
    const alt = field(form,"cover_alt");
    if (cover && (!editorialImage(cover) || !alt || alt.length>180)) return { error: "Add a description for the uploaded cover picture." };
    if (!values.body || !values.summary) return { error: "Enter an article summary and body." };
    const author = field(form,"author");
    if (author.length>100) return { error: "Keep the byline under 100 characters." };
    const previous = id ? await db.from("site_content").select("details").eq("id",id).eq("kind","article").maybeSingle() : null;
    if (previous?.error) return { error: "Could not load the article." };
    details = { cover_url:cover, cover_alt:alt, author:author || "Obsidian Research",
      published_at:previous?.data?.details?.published_at || (isChecked(form,"published") ? new Date().toISOString() : null) };
  } else if (values.kind==="announcement" || values.kind==="promotion") {
    const href = field(form,"href");
    if (href && (!/^\/[a-z0-9/_#?=&-]*$/i.test(href) || href.startsWith("//"))) return { error: "Enter a local link, such as /training." };
    details = { href };
  } else if (values.kind==="testimonial" && isChecked(form,"published")) {
    if (!isChecked(form,"approved_testimonial")) return { error: "Confirm the testimonial is verified and approved for publication." };
    details = { approved:true };
  }
  const payload = { ...values, details, published:isChecked(form,"published"), updated_at:new Date().toISOString() };
  const result = await (id ? db.from("site_content").update(payload).eq("id",id).eq("kind",values.kind) : db.from("site_content").insert(payload)).select("id").single();
  if (result.error || !result.data) return result.error ? message(result.error,"Could not save the content.") : { error:"Could not save the content." };
  revalidatePath("/", "layout");
  if (!id) redirect(`/admin/content/${result.data.id}`);
  return { success: "Content saved." };
}

export async function manageStaff(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStaff(["super_admin"]);
  const parsed = z.object({ email:z.email(),role:z.union([z.enum(ROLES),z.literal("")]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error:errorMessage(parsed) };
  const { error } = await db.rpc("manage_staff",{ p_email:parsed.data.email,p_role:parsed.data.role || null });
  if (error) return message(error,"Could not change staff access.");
  revalidatePath("/admin/staff");
  return { success: "Staff access updated." };
}

export async function resolveEnquiry(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStaff(CONTENT);
  const id = uuid.safeParse(field(form,"id"));
  if (!id.success) return { error: "Invalid enquiry." };
  const { error } = await db.from("contact_enquiries").update({ resolved:field(form,"resolved")==="true" }).eq("id",id.data).select("id").single();
  if (error) return message(error,"Could not update the enquiry.");
  revalidatePath("/admin/enquiries");
  return { success: "Enquiry status updated." };
}

export async function savePaymentInstructions(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStaff(FINANCE);
  const parsed = z.object({ cash_instructions:text("cash payment instructions",1000),
    transfer_instructions:text("transfer instructions",1000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error:errorMessage(parsed) };
  const { error } = await db.from("payment_settings").update({ ...parsed.data, updated_at:new Date().toISOString() })
    .eq("singleton",true).select("singleton").single();
  if (error) return message(error,"Could not save payment instructions.");
  revalidatePath("/admin/finance");
  return { success: "Payment instructions updated." };
}
