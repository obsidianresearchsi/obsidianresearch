export const ROLES = ["super_admin", "admin", "finance", "coordinator"] as const;
export type Role = (typeof ROLES)[number];
export const OPERATIONS: Role[] = ["super_admin", "admin", "coordinator"];
export const FINANCE: Role[] = ["super_admin", "admin", "finance"];
export const CONTENT: Role[] = ["super_admin", "admin"];
export const STATUSES = ["submitted", "under_review", "approved", "rejected", "awaiting_payment", "payment_confirmed", "enrolled"] as const;
export type ApplicationStatus = (typeof STATUSES)[number];
export const METHODS = ["flutterwave", "cash", "transfer"] as const;
export type Method = (typeof METHODS)[number];
export const METHOD_LABELS: Record<Method, string> = { flutterwave: "Online · Flutterwave", cash: "Cash at the centre", transfer: "Bank transfer" };
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: "Submitted", under_review: "Under review", approved: "Approved", rejected: "Rejected",
  awaiting_payment: "Awaiting payment", payment_confirmed: "Payment confirmed", enrolled: "Enrolled",
};
export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super administrator", admin: "Administrator", finance: "Finance officer", coordinator: "Training coordinator",
};
export const REVIEW_OPTIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  submitted: ["under_review", "approved", "rejected"],
  under_review: ["approved", "rejected"],
  approved: ["awaiting_payment"],
  rejected: [],
  awaiting_payment: [],
  payment_confirmed: ["enrolled"],
  enrolled: [],
};
export type Content = {
  id: string; kind: string; slug: string; title: string; summary: string; body: string;
  details: Record<string, unknown>; published: boolean; position: number; updated_at: string;
};
export type Course = {
  id: string; slug: string; title: string; category: string; summary: string; description: string;
  objectives: string[]; requirements: string; schedule: string; faq: string; cover_url: string | null;
  accent: "blue" | "gold"; mode: "physical" | "online" | "hybrid" | null; duration: string | null;
  starts_at: string | null; registration_deadline: string | null; phase: string; published: boolean;
  archived: boolean; registrations_open: boolean; fee_kobo: number; capacity: number | null;
  reserved_count: number; installment_min_kobo: number | null; identity_requested: boolean;
};
export type Offer = { course_id: string; label: string; kind: "percent" | "fixed"; value: number; claim_limit: number | null; remaining: number | null; ends_at: string | null };
export type Discount = Offer & { id: string; claimed: number; starts_at: string | null; active: boolean; coupon_code: string | null };

export const THREAD_STATUSES = ["open", "in_review", "approved", "completed", "closed"] as const;
export const THREAD_LABELS = { open: "Open", in_review: "In review", approved: "Approved", completed: "Completed", closed: "Closed" };
export type CustomerThread = {
  id: string; user_id: string; service_id: string | null; subject: string; price_kobo: number | null;
  status: (typeof THREAD_STATUSES)[number]; created_at: string; updated_at: string;
};
export type CustomerMessage = { id: number; thread_id: string; from_staff: boolean; body: string; created_at: string };

export function servicePrice(service: Content) {
  const value = service.details.price_kobo;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
export type Batch = { id: string; course_id: string; name: string; starts_at: string | null; schedule: string; accepting: boolean };
export type Module = { id: string; course_id: string; position: number; title: string; description: string };
export type Account = {
  id: string; reference: string; full_name: string; course_id: string; status: ApplicationStatus;
  payment_method: Method; transfer_reference: string | null; original_kobo: number;
  discount_kobo: number; payable_kobo: number; created_at: string;
};
export type Application = Account & {
  user_id: string; preferred_batch_id: string | null; email: string; phone: string; whatsapp: string | null;
  date_of_birth: string; gender: string | null; address: string; state: string; occupation: string;
  education: string; additional_info: string; installment_min_kobo: number | null;
};
export type FinanceAccount = Account & { course_title: string; paid_kobo: number };
export type Payment = {
  id: string; application_id: string; reference: string; method: Method;
  status: "pending" | "confirmed" | "cancelled"; amount_kobo: number; currency: "NGN";
  external_reference: string | null; provider_transaction_id: string | null;
  checkout_url: string | null; checkout_expires_at: string | null; created_at: string; confirmed_at: string | null;
};
export type Receipt = { id: string; payment_id: string; receipt_number: string; issued_at: string };
export type Student = { user_id: string; student_number: string; created_at: string };
export type Enrollment = { id: string; user_id: string; application_id: string; course_id: string; batch_id: string | null; status: string; created_at: string };

export function money(kobo: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: kobo % 100 === 0 ? 0 : 2 }).format(kobo / 100);
}

export function calendar(value?: string | null) {
  if (!value) return "To be announced";
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(value));
}

export function courseState(course: Course) {
  const spots = course.capacity === null ? null : Math.max(0, course.capacity - course.reserved_count);
  const open = course.published && !course.archived && course.registrations_open &&
    ["upcoming", "starting_soon"].includes(course.phase) && spots !== 0 &&
    (!course.registration_deadline || Date.parse(course.registration_deadline) > Date.now());
  const label = course.phase === "running" ? "Currently running"
    : course.phase === "completed" ? "Completed"
    : spots === 0 ? "Fully booked"
    : open ? course.phase === "starting_soon" ? "Starting soon" : "Open for registration" : "Registration closed";
  return { spots, open, label };
}

export function shortReference(value: string) {
  return value.length > 20 ? `${value.slice(0, 12)}…${value.slice(-5)}` : value;
}

export function displayMode(value?: string | null) {
  return value ? value[0].toUpperCase() + value.slice(1) : "To be announced";
}

export function offerText(offer: Offer) {
  const amount = offer.kind === "percent" ? `${offer.value}% off` : `${money(offer.value)} off`;
  return offer.claim_limit ? `${amount} for the first ${offer.claim_limit} registrations` : amount;
}
