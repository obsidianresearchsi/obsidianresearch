import type { Metadata } from "next";
import { ServiceCard } from "@/components/catalog";
import { ButtonLink, Empty, Intro } from "@/components/ui";
import { catalog } from "@/lib/catalog";

export const metadata: Metadata = { title: "Services", description: "Explore Obsidian Research’s eight specialist business divisions." };

export default async function Services() {
  const { content } = await catalog();
  const items = content.filter((item) => item.kind === "service");
  return <><Intro label="Our expertise" title="Technology and professional services">Find the right division for your project or enquiry.</Intro>
    <section className="section"><div className="wrap">{items.length ? <div className="service-grid">
      {items.map((service, i) => <ServiceCard key={service.id} service={service} i={i} />)}
    </div> : <Empty title="The service catalogue is unavailable"><ButtonLink href="/contact">Ask our team</ButtonLink></Empty>}</div></section>
  </>;
}
