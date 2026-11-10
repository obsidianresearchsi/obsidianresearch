import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, Intro } from "@/components/ui";
import { company, DEFAULT_COMPANY, detail } from "@/lib/catalog";

export const metadata: Metadata = { title: "Training policies & privacy", description: "Student rules, registration terms, cancellation and refund policies, and the Obsidian Research privacy notice." };

export default async function Policies() {
  const info = await company();
  const phone = detail(info, "phone", DEFAULT_COMPANY.details.phone as string);
  const address = detail(info, "address", DEFAULT_COMPANY.details.address as string);
  return <><Intro label="Student resources / Version 1.0" title="Training policies & privacy">
    Read these policies before submitting an application or making a payment.
  </Intro><section className="section-compact"><div className="wrap narrow stack">
    <nav className="row" aria-label="Policy sections">
      {[["rules","Student rules"],["terms","Training terms"],["refund","Payment and refunds"],["privacy","Privacy"]].map(([id,label]) =>
        <a href={`#${id}`} className="button button-ghost" key={id}>{label}</a>)}
    </nav>
    <section className="panel prose" id="rules"><h2>Student rules & regulations</h2><ul>
      <li>Attend scheduled sessions, arrive on time and participate. Tell the centre in advance if you cannot attend.</li>
      <li>Treat staff, instructors and other students with respect. Harassment, intimidation, discrimination and disruptive conduct are prohibited.</li>
      <li>Use course materials for your education. Obtain written permission before reproducing, distributing, selling or commercially using proprietary materials.</li>
      <li>Use equipment responsibly and report safety concerns. Damage from negligence or deliberate misconduct may result in liability under applicable law.</li>
      <li>Follow the written payment arrangement. Discounts apply according to their published eligibility and limits.</li>
    </ul></section>
    <section className="panel prose" id="terms"><h2>Training terms</h2>
      <p>Submitting an application records your request for a place and calculates the registration fee with any eligible discount. If you choose Flutterwave, you can pay that amount while the centre reviews your application. Follow updates about your place and training dates and keep your application reference.</p>
      <p>Request a change of batch in writing. Approval depends on availability and circumstances. Missing a session does not automatically give a right to a refund or a free replacement session.</p>
      <p>Serious breaches may result in suspension or dismissal after notice and a fair opportunity to respond, subject to applicable law.</p>
      <p>Forex training is educational and does not constitute investment advice or guarantee profits, trading success, employment or financial returns. Networking training does not guarantee a job, certification or specific career result unless agreed in writing.</p>
    </section>
    <section className="panel prose" id="refund"><h2>Payments, cancellations & refunds</h2>
      <p>Check your confirmed fee and payment instructions in the student dashboard. Pay online through the hosted checkout, in cash at the centre, or by verified bank transfer. Keep the receipt or payment reference. A transfer reference alone does not confirm receipt of funds.</p>
      <p>You may cancel an advance booking. Amounts paid are refunded less any lawful, reasonable cancellation charge, taking account of notice, resources committed, the chance of filling the place and industry practice. A charge does not apply if death or hospitalisation prevents attendance as provided by law.</p>
      <p>After training starts, fees for services already delivered are generally non-refundable on voluntary withdrawal. The centre assesses the unused portion fairly. If the centre cancels or cannot provide agreed training, it offers a refund for undelivered services or an available alternative batch you may choose. Statutory rights and remedies remain in place.</p>
    </section>
    <section className="panel prose" id="privacy"><h2>Privacy notice</h2>
      <p>Obsidian Research uses account and application details to manage enrolment, training records, payments and communication. We use necessary information to take steps you request or administer the agreement, and keep records required by law. Optional identity evidence is requested only where necessary and with separate consent. Ask the centre about alternative verification if you decline.</p>
      <p>Access is limited to authorised staff and service providers who need the data, and authorities where disclosure is required. Role-based access and private storage protect application records. When you choose Flutterwave, the payment provider receives the customer details needed to process checkout. Staff review applications.</p>
      <p>Unenrolled applications are kept for 90 days after a final decision or withdrawal, training records for 24 months after completion or withdrawal, and full NIN and photographs for up to 30 days after verification or application closure, whichever comes first. Legal record obligations or documented dispute holds may require longer retention.</p>
      <p>You may request access, correction, erasure, restriction or portability, object to processing where applicable, or withdraw optional consent without affecting prior lawful use. Contact us at {phone} or write to {address} You may also <a href="https://services.ndpc.gov.ng/breach/">contact the Nigeria Data Protection Commission</a>.</p>
    </section>
    <div className="row"><ButtonLink href="/dashboard/documents">Open the document library</ButtonLink><Link className="text-link" href="/contact">Ask the training centre</Link></div>
  </div></section></>;
}
