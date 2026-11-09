import type { Metadata } from "next";
import { ButtonLink, Eyebrow, Intro, SectionHeading } from "@/components/ui";
import { ServiceCard } from "@/components/catalog";
import { catalog, company, detail, TAGLINE } from "@/lib/catalog";

export const metadata: Metadata = { title: "About us", description: "Learn how Obsidian Research approaches technology services and practical professional training." };

export default async function About() {
  const [info, { content }] = await Promise.all([company(), catalog()]);
  return <>
    <Intro label="Company profile" title="About Obsidian Research">{detail(info,"tagline",TAGLINE)}</Intro>
    <section className="section section-white"><div className="wrap split split-even">
      <div className="editorial"><Eyebrow>Technology & education</Eyebrow><h2>How we work</h2>
        <p>{info.summary}</p><p className="whitespace-pre-line">{info.body}</p>
        <p>Our academy teaches practical networking and financial-market analysis, with a focus on applying concepts in real scenarios.</p>
        <ButtonLink href="/training" variant="dark">Explore the academy</ButtonLink>
      </div>
      <div className="stack">
        <div className="story-image"><img src="/media/networking.webp" alt="Network engineer working on switch infrastructure" /></div>
        {detail(info,"mission") && <div className="panel"><h3>Our mission</h3><p>{detail(info,"mission")}</p></div>}
        {detail(info,"vision") && <div className="panel"><h3>Our vision</h3><p>{detail(info,"vision")}</p></div>}
      </div>
    </div></section>
    <section className="section"><div className="wrap"><SectionHeading label="Our divisions" title="Areas of expertise" />
      <div className="service-grid">{content.filter((row) => row.kind === "service").map((service, i) =>
        <ServiceCard key={service.id} service={service} i={i} />)}</div>
    </div></section>
  </>;
}
