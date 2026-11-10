import "server-only";
import { siteOrigin } from "./catalog";
import { privilegedDb } from "./supabase";

export async function sendMail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) return;
  try {
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
      signal: AbortSignal.timeout(6000),
    });
    if (!result.ok) console.error("Application email delivery was unsuccessful.", result.status);
  } catch {
    console.error("Application email service could not be reached.");
  }
}

export async function notifyContactEnquiry(id: string) {
  const db = privilegedDb();
  try {
    const result = await db?.from("contact_enquiries")
      .select("id,created_at,notification_status,full_name,email,topic,message,resolved").eq("id", id).maybeSingle();
    const enquiry = result?.data;
    if (!db || !enquiry || enquiry.resolved) return "unavailable";
    if (enquiry.notification_status === "sent") return "sent";
    // Resend keeps idempotency keys for 24 hours. Avoid an ambiguous retry after that window.
    if (Date.now() - Date.parse(enquiry.created_at) >= 23 * 60 * 60 * 1000) return "expired";
    const key = process.env.RESEND_API_KEY;
    const from = process.env.MAIL_FROM;
    const to = process.env.CONTACT_NOTIFICATION_EMAIL || "obsidianresearch.si@gmail.com";
    let status = "unconfigured";
    if (key && from) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json",
            "Idempotency-Key": `contact-enquiry/${id}` },
          body: JSON.stringify({
            from, to: [to], reply_to: enquiry.email, subject: "New Obsidian Research website enquiry",
            text: `From: ${enquiry.full_name} <${enquiry.email}>\nTopic: ${enquiry.topic}\n\n${enquiry.message}\n\nAdmin inbox: ${siteOrigin()}/admin/enquiries\nEnquiry ID: ${id}`,
          }),
          signal: AbortSignal.timeout(6000),
        });
        status = response.ok ? "sent" : "failed";
      } catch {
        status = "failed";
      }
    }
    const saved = await db.from("contact_enquiries").update({ notification_status: status }).eq("id", id)
      .neq("notification_status", "sent").select("id").maybeSingle();
    if (saved.error) throw new Error("Notification status could not be stored.");
    return saved.data ? status : "sent";
  } catch {
    console.error("Contact notification could not be processed", { enquiryId: id });
    return "unavailable";
  }
}
