import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { cache } from "react";
import { privilegedDb } from "./supabase";

export type StoredFlutterwave = {
  enabled: boolean; secret_ciphertext: string | null; webhook_ciphertext: string | null;
};

function encryptionKey() {
  return Buffer.from(process.env.PAYMENT_SETTINGS_ENCRYPTION_KEY ?? "", "base64");
}

export function canEncryptPayments() {
  return encryptionKey().length === 32;
}

export function encryptPaymentSecret(value: string, field: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm",encryptionKey(),iv);
  cipher.setAAD(Buffer.from(field));
  const data = Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  return ["v1",iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),data.toString("base64url")].join(".");
}

function decryptPaymentSecret(value: string, field: string) {
  const [version,iv,tag,data] = value.split(".");
  if (version !== "v1") throw new Error("Unknown payment settings format.");
  const cipher = createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(iv,"base64url"));
  cipher.setAAD(Buffer.from(field));
  cipher.setAuthTag(Buffer.from(tag,"base64url"));
  return Buffer.concat([cipher.update(Buffer.from(data,"base64url")),cipher.final()]).toString("utf8");
}

export const storedFlutterwave = cache(async () => {
  const db = privilegedDb();
  if (!db) return null;
  const result = await db.from("flutterwave_settings").select("enabled,secret_ciphertext,webhook_ciphertext")
    .eq("id",true).single<StoredFlutterwave>();
  return result.error ? null : result.data;
});

export const flutterwaveConfiguration = cache(async () => {
  const settings = await storedFlutterwave();
  if (!settings) return null;
  try {
    return { enabled:settings.enabled,
      secret:settings.secret_ciphertext ? decryptPaymentSecret(settings.secret_ciphertext,"secret_ciphertext") : process.env.FLUTTERWAVE_SECRET_KEY,
      webhook:settings.webhook_ciphertext ? decryptPaymentSecret(settings.webhook_ciphertext,"webhook_ciphertext") : process.env.FLUTTERWAVE_WEBHOOK_SECRET };
  } catch {
    return null;
  }
});
