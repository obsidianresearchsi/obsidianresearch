import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
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
  constructor(public reason: "configuration" | "pending" | "mismatch" | "provider", message: string) {
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

export async function initialiseCheckout(input: { reference: string; amountKobo: number; email: string; name: string }) {
  const settings = await flutterwaveConfiguration();
  const secret = settings?.secret;
  if (!settings?.enabled || !secret || !settings.webhook) throw new PaymentError("configuration", "Online checkout is being configured.");
  const amount = input.amountKobo / 100;
  const result = z.object({ status: z.literal("success"), data: z.object({ link: z.url() }) }).safeParse(
    await request("/payments", {
      tx_ref: input.reference, amount, currency: "NGN",
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

export async function authenticWebhook(header: string | null) {
  if (!header) return false;
  const secret = (await flutterwaveConfiguration())?.webhook;
  if (!secret || !header) return false;
  const actual = Buffer.from(header);
  const expected = Buffer.from(secret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const verifyResponse = z.object({
  status: z.literal("success"),
  data: z.object({
    id: z.union([z.string(), z.number()]),
    tx_ref: z.string(),
    status: z.string(),
    currency: z.string(),
    amount: z.union([z.string(), z.number()]),
  }),
});

export async function verifyFlutterwave(transaction: string, expectedReference?: string) {
  if (!/^\d{1,30}$/.test(transaction)) throw new PaymentError("mismatch", "Invalid transaction ID.");
  const parsed = verifyResponse.safeParse(await request(`/transactions/${transaction}/verify`));
  if (!parsed.success) throw new PaymentError("provider", "Flutterwave did not return a verifiable payment.");
  const payment = parsed.data.data;
  if (payment.status !== "successful") throw new PaymentError("pending", "Flutterwave has not confirmed the payment.");
  const amount = toKobo(String(payment.amount));
  if (String(payment.id) !== transaction || !/^ORP-[a-f0-9]{32}$/.test(payment.tx_ref) ||
    (expectedReference && payment.tx_ref !== expectedReference) || payment.currency !== "NGN" || amount === null) {
    throw new PaymentError("mismatch", "The transaction does not match the checkout reference.");
  }
  const db = privilegedDb();
  if (!db) throw new PaymentError("configuration", "Payment verification is being configured.");
  const { data, error } = await db.rpc("confirm_flutterwave", {
    p_ref: payment.tx_ref, p_transaction: transaction, p_amount: amount, p_currency: payment.currency,
  });
  if (error) throw new PaymentError(error.code === "P0001" ? "mismatch" : "provider",
    "The verified transaction needs finance review before it can be recorded.");
  return data as string;
}
