import Link from "next/link";
import { ArrowUpRight, Check, GraduationCap, MapPin, Network } from "lucide-react";
import { CourseCard, ServiceCard } from "@/components/catalog";
import { StructuredData } from "@/components/structured-data";
import { ButtonLink, Empty, Eyebrow, SectionHeading } from "@/components/ui";
import { catalog, company, detail, TAGLINE } from "@/lib/catalog";
import { courseState } from "@/lib/model";

export default async function Home() {
  const [{ content, courses, offers, available }, info] = await Promise.all([catalog(), company()]);
  const services = content.filter((item) => item.kind === "service");
  const updates = content.filter((item) => item.kind === "announcement" || item.kind === "promotion");
  const faqs = content.filter((item) => item.kind === "faq");
  const testimonials = content.filter((item) => item.kind === "testimonial");
  const featured = [...courses].sort((a,b) => Number(courseState(b).open) - Number(courseState(a).open)).slice(0, 4);
  return <>
    <StructuredData data={{
      "@context": "https://schema.org", "@type": "Organization", name: "Obsidian Research",
      url: detail(info,"website","https://www.obsidianresearch.si"),
      telephone: detail(info,"phone","+234 906 341 2927"),
      address: { "@type": "PostalAddress", streetAddress: detail(info,"address"), addressRegion: "Katsina", addressCountry: "NG" },
    }} />
    <section className="hero" aria-labelledby="home-title">
      <div className="hero-media" aria-hidden="true" />
      <div className="wrap hero-inner">
        <Eyebrow>Technology · Training · Consulting</Eyebrow>
        <h1 id="home-title">Build what’s next.<br /><span>Learn what matters.</span></h1>
        <p className="hero-description">{info.summary}</p>
        <div className="hero-actions"><ButtonLink href="/services">Explore our services</ButtonLink>
          <ButtonLink href="/training" variant="ghost">Explore training programs</ButtonLink></div>
        <p className="hero-tagline">{detail(info, "tagline", TAGLINE)}</p>
        <span className="hero-coordinate" aria-hidden="true">01 / NETWORK INFRASTRUCTURE</span>
      </div>
    </section>
    <div className="signal-bar"><div className="wrap signal-items">
      <div><Network size={19} aria-hidden /> Technology & infrastructure</div>
      <div><GraduationCap size={20} aria-hidden /> Practical professional training</div>
      <div><MapPin size={19} aria-hidden /> Based in Katsina, Nigeria</div>
    </div></div>
    {detail(info,"banner") && <div className="section-compact section-white"><div className="wrap"><div className="announcement"><p>{detail(info,"banner")}</p></div></div></div>}
    <section className="section"><div className="wrap">
      <SectionHeading label="01 / Our expertise" title="Explore our divisions"><ButtonLink href="/services" variant="ghost">All services</ButtonLink></SectionHeading>
      {services.length ? <div className="service-grid">{services.map((service, i) => <ServiceCard key={service.id} service={service} i={i} />)}</div>
        : <Empty title={available ? "Service catalogue coming soon" : "The service catalogue is temporarily unavailable"}><Link href="/contact">Contact our team for project enquiries.</Link></Empty>}
    </div></section>
    <section className="section section-dark"><div className="wrap">
      <SectionHeading label="02 / Obsidian Academy" title="Professional training"><ButtonLink href="/training" variant="ghost">View the academy</ButtonLink></SectionHeading>
      {featured.length ? <div className="course-grid">{featured.map((course) =>
        <CourseCard key={course.id} course={course} offer={offers.find((offer) => offer.course_id === course.id)} />)}</div>
        : <Empty title={available ? "New intakes will appear here" : "Training catalogue unavailable"}>Contact the training centre to ask about courses.</Empty>}
    </div></section>
    <section className="section section-white"><div className="wrap split split-even">
      <div className="story-image"><img src="/media/infrastructure.webp" alt="Enterprise server rack with structured network cabling" loading="lazy" /></div>
      <div className="editorial"><Eyebrow>03 / Our approach</Eyebrow><h2>Practical work, from the lab to the field</h2>
        <p>{info.body}</p>
        <ul className="bullet-list">{["Technology decisions grounded in how you work", "Hands-on learning for real infrastructure and market analysis", "Clear project and training requirements before you start"].map((value) =>
          <li key={value}><Check size={18} aria-hidden /> {value}</li>)}</ul>
        <ButtonLink href="/about" variant="dark">About Obsidian Research</ButtonLink>
      </div>
    </div></section>
    {(updates.length > 0 || faqs.length > 0 || testimonials.length > 0) && <section className="section"><div className="wrap split split-even">
      <div className="stack"><SectionHeading label="04 / News" title="Latest updates" />
        {updates.length ? updates.map((item) => <article className="announcement" key={item.id}>
          <h3>{item.title}</h3><p>{item.summary}</p>{item.body && <p>{item.body}</p>}
          {detail(item,"href").startsWith("/") && !detail(item,"href").startsWith("//") &&
            <Link className="text-link" href={detail(item,"href")}>See details <ArrowUpRight size={15} aria-hidden /></Link>}
        </article>) : <p className="muted">New announcements will appear here.</p>}
        {testimonials.map((item) => <blockquote key={item.id} className="announcement"><p>{item.summary}</p><cite>{item.title}</cite></blockquote>)}
      </div>
      <div><SectionHeading label="05 / Help" title="Common questions" />
        <div className="faq-list">{faqs.map((item) => <details key={item.id}><summary>{item.title}</summary><p>{item.summary}</p>{item.body && <p>{item.body}</p>}</details>)}</div>
      </div>
    </div></section>}
    <section className="cta-band"><div className="wrap"><div><h2>Talk to the Katsina team</h2>
      <p>Discuss a project, ask about a course, or plan a visit to the training centre.</p></div><ButtonLink href="/contact">Get in touch</ButtonLink></div></section>
  </>;
}
