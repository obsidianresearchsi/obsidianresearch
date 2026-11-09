import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { submitApplication } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { CouponEntry } from "@/components/coupon-entry";
import { RegistrationCountdown } from "@/components/registration-clock";
import { ButtonLink, Check, DataList, Field, Intro, Notice, Select, Textarea } from "@/components/ui";
import { courseBySlug } from "@/lib/catalog";
import { courseState, METHOD_LABELS, METHODS, money, offerText } from "@/lib/model";
import { requireStudent } from "@/lib/supabase";

export const metadata: Metadata = { title: "Training application", robots: { index: false, follow: false } };

export default async function Apply({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await courseBySlug(slug);
  if (!detail) notFound();
  const { course, batches, offer } = detail;
  const { db, user } = await requireStudent(`/apply/${slug}`);
  const { data: existing } = await db.from("applications").select("id").eq("user_id",user.id)
    .eq("course_id",course.id).neq("status","rejected").maybeSingle();
  if (existing) redirect(`/dashboard/applications/${existing.id}`);
  const state = courseState(course);
  if (!state.open) return <><Intro label="Application" title={state.spots === 0 ? "This class is fully booked" : "Registration is closed"} />
    <div className="wrap section-compact"><ButtonLink href="/training">Browse training</ButtonLink></div></>;
  const name = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "";
  return <><Intro label="Obsidian Academy / Online application" title="Apply for training">{course.title}</Intro>
    <section className="section-compact"><div className="wrap split">
      <div className="registration-application">
        <RegistrationCountdown open={state.open} deadline={course.registration_deadline} spots={state.spots} initialTime={Date.now()} />
      </div>
      <div className="panel"><h2>Applicant information</h2>
        <ActionForm action={submitApplication} submit="Submit application" closesAt={course.registration_deadline}>
          <input type="hidden" name="course_id" value={course.id} />
          <div className="form-grid">
            <Field label="Full legal name" name="full_name" defaultValue={name} autoComplete="name" maxLength={100} required />
            <Field label="Account email" name="account_email" type="email" defaultValue={user.email} readOnly />
            <Field label="Phone number" name="phone" type="tel" autoComplete="tel" maxLength={25} required />
            <Field label="WhatsApp number (optional)" name="whatsapp" type="tel" maxLength={25} />
            <Field label="Date of birth" name="date_of_birth" type="date" min="1900-01-01" max={new Date().toISOString().slice(0,10)} required />
            <Field label="Gender (optional)" name="gender" maxLength={40} />
            <Textarea className="full" label="Residential address" name="address" autoComplete="street-address" maxLength={300} required />
            <Field label="State of residence" name="state" autoComplete="address-level1" maxLength={80} required />
            <Field label="Occupation" name="occupation" maxLength={100} required />
            <Field label="Educational qualification" name="education" maxLength={100} required />
            <Select label="Preferred batch" name="preferred_batch_id"><option value="">No preference / to be assigned</option>
              {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</Select>
          </div>
          <Select label="Preferred payment method" name="payment_method" required>
            {METHODS.map((method) => <option key={method} value={method}>{METHOD_LABELS[method]}</option>)}
          </Select>
          <CouponEntry course={course.id} />
          <Textarea label="Additional information (optional)" name="additional_info" maxLength={1200} rows={3} />
          {course.identity_requested && <fieldset className="fieldset"><legend>Optional identity verification</legend>
            <p className="small muted">You can ask the centre about another way to verify your identity.</p>
            <Field label="NIN (optional)" name="nin" maxLength={11} inputMode="numeric" pattern="[0-9]{11}" />
            <Field label="Passport photograph (optional)" name="photo" type="file" accept="image/png,image/jpeg" hint="JPEG or PNG, up to 2 MB." />
            <Check name="identity_consent">I consent to the optional identity check described in the privacy notice.</Check>
          </fieldset>}
          <fieldset className="fieldset"><legend>Policy acknowledgement</legend>
            <Check name="rules" required>I agree to the <Link href="/policies#rules" target="_blank">student rules and regulations</Link>.</Check>
            <Check name="terms" required>I agree to the <Link href="/policies#terms" target="_blank">training terms</Link>.</Check>
            <Check name="privacy" required>I have read the <Link href="/policies#privacy" target="_blank">privacy notice</Link>.</Check>
            <Check name="refund" required>I agree to the <Link href="/policies#refund" target="_blank">payment and refund policy</Link>.</Check>
          </fieldset>
        </ActionForm>
      </div>
      <aside className="panel stack"><h2>Registration summary</h2><DataList items={[
        ["Program", course.title], ["Registration fee", money(course.fee_kobo)],
        ["Offer", offer ? offerText(offer) : "Standard registration"], ["Payment due", "After approval"],
      ]} /><Notice>Your application reference and confirmed amount will appear in your dashboard.</Notice></aside>
    </div></section></>;
}
