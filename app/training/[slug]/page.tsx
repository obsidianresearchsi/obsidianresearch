import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { Breadcrumbs, ButtonLink, DataList, Eyebrow } from "@/components/ui";
import { RegistrationBadge, RegistrationCountdown, RegistrationGate } from "@/components/registration-clock";
import { StructuredData } from "@/components/structured-data";
import { courseBySlug, courseCover } from "@/lib/catalog";
import { calendar, courseState, displayMode, money, offerText } from "@/lib/model";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const detail = await courseBySlug((await params).slug);
  return detail ? { title: detail.course.title, description: detail.course.summary,
    openGraph: { images: [{ url: courseCover(detail.course), alt: detail.course.title }] } } : { title: "Course unavailable" };
}

export default async function CourseDetail({ params }: { params: Promise<{ slug: string }> }) {
  const detail = await courseBySlug((await params).slug);
  if (!detail) notFound();
  const { course, modules, batches, offer } = detail;
  const state = courseState(course);
  const apply = `/apply/${course.slug}`;
  return <>
    <StructuredData data={{
      "@context": "https://schema.org", "@type": "Course", name: course.title, description: course.summary,
      provider: { "@type": "Organization", name: "Obsidian Research" },
      offers: { "@type": "Offer", price: course.fee_kobo / 100, priceCurrency: "NGN",
        availability: state.open ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
    }} />
    <header className="course-hero"><img src={courseCover(course)} alt="" /><div className="wrap">
      <Eyebrow>Obsidian Academy / {course.category}</Eyebrow><h1>{course.title}</h1><p>{course.summary}</p>
      <div className="row"><RegistrationBadge open={state.open} deadline={course.registration_deadline} label={state.label} />
        {state.open && <RegistrationGate deadline={course.registration_deadline}>
          <ButtonLink href={apply}>Apply for this program</ButtonLink>
        </RegistrationGate>}</div>
    </div></header>
    <section className="section"><div className="wrap">
      <Breadcrumbs items={[{ label: "Training", href: "/training" }, { label: course.title }]} />
      <div className="split"><div className="stack">
        <section className="panel prose"><h2>Program overview</h2><p className="whitespace-pre-line">{course.description}</p>
          {course.objectives.length > 0 && <><h3>What you’ll learn</h3><ul className="bullet-list">
            {course.objectives.map((objective, i) => <li key={i}><Check size={17} aria-hidden /> {objective}</li>)}
          </ul></>}</section>
        <section className="panel"><h2>Curriculum</h2>
          {modules.length ? <ol className="module-list">{modules.map((module) => <li key={module.id}><b>{String(module.position).padStart(2, "0")}</b>
            <div><strong>{module.title}</strong><p>{module.description}</p></div></li>)}</ol> : <p>Curriculum details will be published here.</p>}
        </section>
        <section className="panel prose"><h2>Requirements & schedule</h2><p className="whitespace-pre-line">{course.requirements || "Ask the centre about requirements for your batch."}</p>
          <p className="whitespace-pre-line">{course.schedule || "The centre will announce the confirmed training schedule."}</p>
          {batches.length > 0 && <ul>{batches.map((batch) => <li key={batch.id}>{batch.name} · {calendar(batch.starts_at)}{batch.schedule && ` · ${batch.schedule}`}</li>)}</ul>}
        </section>
        {course.faq && <section className="panel prose"><h2>Frequently asked questions</h2><p className="whitespace-pre-line">{course.faq}</p></section>}
      </div><aside className="panel stack">
        <div><Eyebrow>Registration</Eyebrow><h2 className="mt-2">{money(course.fee_kobo)}</h2></div>
        <RegistrationCountdown open={state.open} deadline={course.registration_deadline} spots={state.spots} initialTime={Date.now()} />
        {offer && <RegistrationGate deadline={course.registration_deadline}>
          <div className={`offer-strip ${course.accent === "gold" ? "offer-gold" : ""}`}>{offerText(offer)}</div>
        </RegistrationGate>}
        <DataList items={[
          ["Format", displayMode(course.mode)], ["Duration", course.duration || "To be announced"],
          ["Starts", calendar(course.starts_at)],
          ["Installments", course.installment_min_kobo ? `From ${money(course.installment_min_kobo)}` : "Full payment"],
        ]} />
        {state.open ? <RegistrationGate deadline={course.registration_deadline}
          closed={<ButtonLink href="/contact" variant="dark">Ask about the next intake</ButtonLink>}>
          <ButtonLink href={apply}>Start application</ButtonLink>
        </RegistrationGate> : <ButtonLink href="/contact" variant="dark">Ask about the next intake</ButtonLink>}
        <p className="small muted">Payments are available after application approval. Your confirmed fee and any discount appear in your dashboard.</p>
      </aside></div>
    </div></section>
  </>;
}
