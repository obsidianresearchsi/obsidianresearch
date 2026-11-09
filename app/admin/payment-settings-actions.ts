"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEncryptPayments, encryptPaymentSecret } from "@/lib/flutterwave-settings";
import type { FormState } from "@/lib/forms";
import { privilegedDb, requireStaff } from "@/lib/supabase";

export async function saveFlutterwaveSettings(_: FormState, form: FormData): Promise<FormState> {
  await requireStaff(["super_admin"]);
  const input = z.object({
    secret:z.string().trim().max(256).regex(/^(?:FLWSECK[_A-Z0-9a-z-]+)?$/),
    webhook:z.string().trim().max(256),
  }).safeParse(Object.fromEntries(form));
  if (!input.success) return { error:"Enter a valid Flutterwave secret key and webhook secret." };
  const db = privilegedDb();
  if (!db) return { error:"Server payment access must be configured first." };
  const { secret,webhook } = input.data;
  if ((secret || webhook) && !canEncryptPayments()) return { error:"Set the server payment encryption key before saving credentials." };
  const values = { enabled:form.get("enabled")==="on", updated_at:new Date().toISOString(),
    ...(secret ? { secret_ciphertext:encryptPaymentSecret(secret,"secret_ciphertext") } : {}),
    ...(webhook ? { webhook_ciphertext:encryptPaymentSecret(webhook,"webhook_ciphertext") } : {}) };
  const { error } = await db.from("flutterwave_settings").update(values).eq("id",true).select("id").single();
  if (error) return { error:"Could not save Flutterwave settings." };
  revalidatePath("/admin/settings");
  return { success:"Flutterwave settings saved." };
}
