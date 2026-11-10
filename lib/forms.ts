import { z } from "zod";
import { METHODS } from "./model";

export type FormState = { error?: string; success?: string };
export const initialFormState: FormState = {};
export const uuid = z.uuid();
export const phone = z.string().trim().regex(/^\+?[0-9 ()-]{7,25}$/, "Enter a valid phone number.");
export const optText = (max: number) => z.string().trim().max(max).optional().default("");
export const text = (label: string, max: number, min = 1) =>
  z.string().trim().min(min, `Enter ${label}.`).max(max, `${label} is too long.`);
export const date = z.iso.date();
export const optionalDate = z.union([z.literal(""), date]);
export const email = z.email("Enter a valid email address.").max(254);
export const checked = z.literal("on", { error: "Please acknowledge all required policies." });
export const optionalUuid = z.union([uuid, z.literal("")]);
export const couponCode = z.string().trim().toUpperCase().regex(/^(?:[A-Z0-9][A-Z0-9-]{2,31})?$/, "Enter a valid coupon code.");
export const applicationSchema = z.object({
  course_id: uuid,
  full_name: text("your full name", 100, 2),
  phone,
  whatsapp: z.union([phone, z.literal("")]),
  date_of_birth: date.refine((v) => v >= "1900-01-01" && v <= new Date().toISOString().slice(0, 10), "Enter a valid date of birth."),
  gender: optText(40),
  address: text("your residential address", 300, 3),
  state: text("your state of residence", 80, 2),
  occupation: text("your occupation", 100),
  education: text("your educational qualification", 100),
  preferred_batch_id: optionalUuid,
  additional_info: optText(1200),
  payment_method: z.enum(METHODS),
  rules: checked, terms: checked, privacy: checked, refund: checked,
  nin: z.string().trim().regex(/^(?:[0-9]{11})?$/, "Enter an 11-digit NIN or leave it blank.").optional(),
  identity_consent: z.literal("on").optional(),
  coupon_code: couponCode.optional(),
});

export function errorMessage(result: { error: { issues: { message: string }[] } }) {
  return result.error.issues[0]?.message || "Check the information you entered.";
}

export function toKobo(value: string) {
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, cents = ""] = value.split(".");
  return Number(whole) * 100 + Number(cents.padEnd(2, "0"));
}

export function safePath(input: string | undefined, fallback = "/dashboard") {
  if (input === "/services/interior-design#interior-planner" || input === "/services/advanced-networking#network-studio") return input;
  if (typeof input !== "string" || !/^\/(?:dashboard|apply|admin|account\/update)(?:[/?]|$)/.test(input) || /[\\\r\n]/.test(input)) return fallback;
  return input;
}
