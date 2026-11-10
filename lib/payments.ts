import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { privilegedDb } from "./supabase";
import { siteOrigin } from "./catalog";
import { toKobo } from "./forms";
import { flutterwaveConfiguration } from "./flutterwave-settings";

export async function checkoutAvailable() {
  const settings = await flutterwaveConfiguration();
  return Boolean(settings?.enabled && settings.secret && settings.webhook);
}

export class PaymentError extends Error {
  constructor(public reason: "configuration" | "pending" | "failed" | "mismatch" | "provider", message: string) {
    super(message);
  }
}

async function request(path: string, body?: object, providedSecret?: string) {
  const secret = providedSecret || (await flutterwaveConfiguration())?.secret;
  if (!secret) throw new PaymentError("configuration", "Online checkout is being configured.");
  const response = await fetch(`https://api.flutterwave.com/v3${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(13_000),
  });
  if (!response.ok) throw new PaymentError("provider", "Flutterwave could not complete the request.");
  return response.json() as Promise<unknown>;
}

const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

export function checkoutLinkExpiry(reservedUntil: string) {
  // Keep the last 15 minutes of the database reservation for delayed confirmations.
  return Date.parse(reservedUntil) - 15 * 60_000;
}

export async function initialiseCheckout(input: { reference: string; amountKobo: number; email: string; name: string; expiresAt: number }) {
  const settings = await flutterwaveConfiguration();
  const secret = settings?.secret;
  if (!settings?.enabled || !secret || !settings.webhook) throw new PaymentError("configuration", "Online checkout is being configured.");
  const amount = input.amountKobo / 100;
  const result = z.object({ status: z.literal("success"), data: z.object({ link: z.url() }) }).safeParse(
    await request("/payments", {
      tx_ref: input.reference, amount, currency: "NGN",
      link_expiration: new Date(input.expiresAt).toISOString(),
      redirect_url: `${siteOrigin()}/api/payments/callback`,
      customer: { email: input.email, name: input.name },
      configurations: { session_duration: 30, max_retry_attempt: 3 },
      customizations: { title: "Obsidian Research", description: "Training registration payment" },
      payload_hash: hash(`${amount}NGN${input.email}${input.reference}${hash(secret)}`),
    },secret),
  );
  if (!result.success) throw new PaymentError("provider", "Flutterwave did not return a checkout link.");
  const url = new URL(result.data.data.link);
  if (url.origin !== "https://checkout.flutterwave.com") throw new PaymentError("provider", "The checkout link was unexpected.");
  return url.href;
}

export async function authenticWebhook(headers: Headers, body: Buffer) {
  const signature = headers.get("flutterwave-signature");
  const legacy = headers.get("verif-hash");
  if (!signature && !legacy) return false;
  const secret = (await flutterwaveConfiguration())?.webhook;
  if (!secret) return null;
  const actual = Buffer.from(signature ?? legacy ?? "");
  const expected = Buffer.from(signature !== null ? createHmac("sha256", secret).update(body).digest("base64") : secret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

type PaymentSource = "checkout" | "webhook" | "callback" | "admin";
export const checkoutReference = /^ORP-[a-f0-9]{32}$/;
export const transactionId = /^\d{1,30}$/;

export async function logFlutterwave(action: string, source: PaymentSource, ref?: string, transaction?: string) {
  const db = privilegedDb();
  const safeRef = ref && checkoutReference.test(ref) ? ref : null;
  const safeId = transaction && transactionId.test(transaction) ? transaction : null;
  try {
    const result = await db?.rpc("log_flutterwave_event", {
      p_action: action, p_source: source, p_ref: safeRef, p_transaction: safeId,
    });
    if (result && !result.error) return true;
  } catch { /* Fall back to the application log when the database is unavailable. */ }
  console.error("Flutterwave audit unavailable", { action, source, reference: safeRef, transaction: safeId });
  return false;
}

const verifyResponse = z.object({
  status: z.literal("success"),
  data: z.object({
    id: z.union([z.string(), z.number().int().positive().max(Number.MAX_SAFE_INTEGER)]),
    tx_ref: z.string(),
    status: z.string(),
    currency: z.string(),
    amount: z.union([z.string(), z.number()]),
  }),
});

async function fetchVerifiedTransaction(transaction: string) {
  if (!transactionId.test(transaction)) throw new PaymentError("mismatch", "Invalid transaction ID.");
  const parsed = verifyResponse.safeParse(await request(`/transactions/${transaction}/verify`));
  if (!parsed.success) throw new PaymentError("provider", "Flutterwave did not return a verifiable payment.");
  return parsed.data.data;
}

export async function verifyFlutterwave(transaction: string, expectedReference: string | undefined, source: PaymentSource) {
  let payment;
  try {
    payment = await fetchVerifiedTransaction(transaction);
    if (String(payment.id) !== transaction || !checkoutReference.test(payment.tx_ref) ||
      (expectedReference && payment.tx_ref !== expectedReference)) {
      throw new PaymentError("mismatch", "The transaction does not match the checkout reference.");
    }
    if (payment.status === "failed" || payment.status === "cancelled") {
      throw new PaymentError("failed", "Flutterwave reports that this payment attempt failed.");
    }
    if (payment.status !== "successful") throw new PaymentError("pending", "Flutterwave has not confirmed the payment.");
  } catch (error) {
    const issue = error instanceof PaymentError ? error : new PaymentError("provider", "Flutterwave could not be reached.");
    const logged = await logFlutterwave(issue.reason, source, expectedReference ?? payment?.tx_ref, transaction);
    if (!logged && source === "webhook") throw new PaymentError("provider", "Payment audit is temporarily unavailable.");
    throw issue;
  }
  const amount = toKobo(String(payment.amount));
  const db = privilegedDb();
  if (!db) throw new PaymentError("configuration", "Payment verification is being configured.");
  const { data, error } = await db.rpc("confirm_flutterwave", {
    p_ref: payment.tx_ref, p_transaction: transaction, p_amount: amount,
    p_currency: /^[A-Z]{3}$/.test(payment.currency) ? payment.currency : null, p_source: source,
  });
  if (error || typeof data !== "string") {
    await logFlutterwave("ledger_unavailable", source, payment.tx_ref, transaction);
    throw new PaymentError("provider", "The verified transaction could not be recorded. Please try again.");
  }
  if (["unknown_reference", "details_mismatch", "reference_reused", "transaction_reused", "balance_review"].includes(data)) {
    throw new PaymentError("mismatch", "The verified transaction needs finance review before it can be recorded.");
  }
  if (data !== "confirmed" && data !== "duplicate") {
    await logFlutterwave("unexpected_ledger_result", source, payment.tx_ref, transaction);
    throw new PaymentError("provider", "The verified transaction could not be recorded. Please try again.");
  }
  return data;
}
