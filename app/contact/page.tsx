import type { Metadata } from "next";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import { contactEnquiry } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Field, Intro, Textarea } from "@/components/ui";
import { company, DEFAULT_COMPANY, detail } from "@/lib/catalog";

export const metadata: Metadata = { title: "Contact", description: "Contact Obsidian Research about services, training or a visit to the Katsina training centre." };

export default async function Contact({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const [info, query] = await Promise.all([company(), searchParams]);
  const phone = detail(info, "phone", DEFAULT_COMPANY.details.phone as string);
  const number = phone.replace(/\D/g, "");
  const email = detail(info, "email");
  return <><Intro label="Contact the team" title="How can we help?">Tell us what you’re working on or ask about an upcoming training program.</Intro>
    <section className="section"><div className="wrap split">
      <div className="panel"><h2>Send an enquiry</h2>
        <ActionForm action={contactEnquiry} submit="Send enquiry">
          <div className="form-grid"><Field name="full_name" label="Full name" autoComplete="name" maxLength={100} required />
            <Field type="email" name="email" label="Email address" autoComplete="email" maxLength={254} required /></div>
          <Field name="topic" label="Topic" defaultValue={query.topic?.slice(0,120)} maxLength={120} required />
          <Textarea name="message" label="Message" minLength={10} maxLength={2000} rows={5} required />
          <input className="hidden-trap" name="fax" tabIndex={-1} autoComplete="off" aria-hidden />
          <p className="small muted">Please keep identity documents and payment details out of this message.</p>
        </ActionForm>
      </div>
      <aside className="panel stack"><h2>Training centre</h2>
        <p className="row"><MapPin size={20} aria-hidden />{detail(info, "address", DEFAULT_COMPANY.details.address as string)}</p>
        <a className="text-link" href={`tel:+${number}`}><Phone size={17} aria-hidden />{phone}</a>
        <a className="text-link" href={`https://wa.me/${number}`}><MessageCircle size={17} aria-hidden />Message us on WhatsApp</a>
        {email && <a className="text-link" href={`mailto:${email}`}>{email}</a>}
      </aside>
    </div></section>
  </>;
}
