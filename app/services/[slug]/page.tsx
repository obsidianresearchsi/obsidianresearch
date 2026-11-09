import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUpRight, Check } from "lucide-react";
import { ServiceIcon } from "@/components/catalog";
import { SolarEstimator } from "@/components/solar-estimator";
import { Breadcrumbs, ButtonLink, Eyebrow } from "@/components/ui";
import { catalog, company, detail, detailsList, SERVICE_VISUALS, WHATSAPP } from "@/lib/catalog";
import { money, servicePrice } from "@/lib/model";
import { SOLAR_SERVICE, solarPrices } from "@/lib/solar";

const serviceFor = async (slug: string) => (await catalog()).content.find((row) => row.kind === "service" && row.slug === slug);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const service = await serviceFor((await params).slug);
  return service ? { title: service.title, description: service.summary } : { title: "Service unavailable" };
}

export default async function ServiceDetail({ params }: { params: Promise<{ slug: string }> }) {
  const service = await serviceFor((await params).slug);
  if (!service) notFound();
  const visual = SERVICE_VISUALS[service.slug];
  const offerings = detailsList(service, "offerings");
  const benefits = detailsList(service, "benefits");
  const price = servicePrice(service);
  const solar = service.slug === SOLAR_SERVICE;
  const phone = solar ? detail(await company(), "phone").replace(/\D/g, "") : "";
  const whatsapp = /^\d{8,15}$/.test(phone) ? `https://wa.me/${phone}` : WHATSAPP;
  return <>
    <header className="course-hero">{visual?.image && <img src={visual.image} alt="" />}
      <div className="wrap"><Eyebrow>Obsidian Research / Business divisions</Eyebrow>
        <div className="row"><ServiceIcon slug={service.slug} size={32} /></div><h1>{service.title}</h1><p>{service.summary}</p>
        <div className="row">
          {solar && <ButtonLink href="#solar-estimator">Estimate my setup</ButtonLink>}
          <ButtonLink href={`/dashboard/services?service=${service.slug}`} variant={solar ? "ghost" : "primary"} arrow="up">Request this service</ButtonLink>
        </div>
      </div>
    </header>
    <section className="section"><div className="wrap">
      <Breadcrumbs items={[{ label: "Services", href: "/services" }, { label: service.title }]} />
      {solar && <SolarEstimator prices={solarPrices(service.details.solar_prices)} whatsapp={whatsapp} />}
      <div className="split"><div className="prose"><h2>What we do</h2><p className="whitespace-pre-line">{service.body}</p>
        {offerings.length > 0 && <><h3>Key offerings</h3><ul>{offerings.map((item) => <li key={item}>{item}</li>)}</ul></>}
      </div><aside className="panel"><h2>How we can help</h2>
        <p className="service-price">{price === null ? "Quote on request" : money(price)}</p>
        {benefits.length > 0 && <ul className="bullet-list">{benefits.map((benefit) => <li key={benefit}><Check size={18} aria-hidden />{benefit}</li>)}</ul>}
        <a className="text-link" href={`/contact?topic=${encodeURIComponent(service.title)}`}>Discuss your requirements <ArrowUpRight size={16} aria-hidden /></a>
      </aside></div>
    </div></section>
  </>;
}
