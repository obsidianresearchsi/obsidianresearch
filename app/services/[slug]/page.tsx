import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUpRight, Check } from "lucide-react";
import { ServiceIcon } from "@/components/catalog";
import { SolarEstimator } from "@/components/solar-estimator";
import { InteriorPlanner } from "@/components/interior-planner";
import { NetworkStudio } from "@/components/network-studio";
import { Breadcrumbs, ButtonLink, Eyebrow } from "@/components/ui";
import { catalog, company, detail, detailsList, SERVICE_VISUALS, WHATSAPP } from "@/lib/catalog";
import { money, servicePrice } from "@/lib/model";
import { SOLAR_SERVICE, solarAppliances, solarPrices } from "@/lib/solar";
import { INTERIOR_SERVICE, interiorPrices } from "@/lib/interior";
import { NETWORK_SERVICE, NETWORK_STUDIO, networkPlanSchema, networkPrices, type NetworkPlan } from "@/lib/network";
import { readEquipment } from "@/lib/studio-equipment";
import { publicDb, session } from "@/lib/supabase";

const serviceFor = async (slug: string) => (await catalog()).content.find((row) => row.kind === "service" && row.slug === slug);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const service = await serviceFor((await params).slug);
  return service ? { title: service.title, description: service.summary } : { title: "Service unavailable" };
}

export default async function ServiceDetail({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ review?: string | string[] }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const service = await serviceFor(slug);
  if (!service) notFound();
  const visual = SERVICE_VISUALS[service.slug];
  const offerings = detailsList(service, "offerings");
  const benefits = detailsList(service, "benefits");
  const price = servicePrice(service);
  const solar = service.slug === SOLAR_SERVICE;
  const interior = service.slug === INTERIOR_SERVICE;
  const network = service.slug === NETWORK_SERVICE;
  const [info, account, equipmentResult] = await Promise.all([
    solar || interior || network ? company() : null, interior || network ? session() : null,
    solar || network ? publicDb()?.from("studio_equipment").select("*").eq("active",true).order("brand").order("model") : null,
  ]);
  let equipment = readEquipment(equipmentResult?.data);
  let reviewPlan: NetworkPlan | undefined;
  let quotePrices = network ? networkPrices(service.details.network_prices) : undefined;
  if (network && query.review !== undefined) {
    if (!account || typeof query.review !== "string" || !/^[1-9]\d{0,14}$/.test(query.review)) notFound();
    const { data } = await account.db.from("customer_messages").select("network_plan").eq("id",query.review).maybeSingle();
    const parsed = networkPlanSchema.safeParse(data?.network_plan?.plan);
    if (!parsed.success) notFound();
    reviewPlan = parsed.data;
    quotePrices = networkPrices(data?.network_plan?.prices);
    equipment = readEquipment(data?.network_plan?.equipment);
  }
  const phone = info ? detail(info, "phone").replace(/\D/g, "") : "";
  const whatsapp = /^\d{8,15}$/.test(phone) ? `https://wa.me/${phone}` : WHATSAPP;
  return <>
    <header className="course-hero">{visual?.image && <img src={visual.image} alt="" />}
      <div className="wrap"><Eyebrow>Obsidian Research / Business divisions</Eyebrow>
        <div className="row"><ServiceIcon slug={service.slug} size={32} /></div><h1>{service.title}</h1><p>{service.summary}</p>
        <div className="row">
          {solar && <ButtonLink href="#solar-estimator">Estimate my setup</ButtonLink>}
          {interior && <ButtonLink href="#interior-planner">Open 3D studio</ButtonLink>}
          {network && <ButtonLink href="#network-studio">Open Network Studio</ButtonLink>}
          {service.slug === "starlink" && <ButtonLink href={NETWORK_STUDIO} variant="ghost">Plan a Starlink network</ButtonLink>}
          <ButtonLink href={`/dashboard/services?service=${service.slug}`} variant={solar || interior || network ? "ghost" : "primary"} arrow="up">Request this service</ButtonLink>
        </div>
      </div>
    </header>
    <section className="section"><div className="wrap">
      <Breadcrumbs items={[{ label: "Services", href: "/services" }, { label: service.title }]} />
      {solar && <SolarEstimator prices={solarPrices(service.details.solar_prices)} appliances={solarAppliances(service.details.solar_appliances)} whatsapp={whatsapp}
        equipment={equipment.filter((item) => item.kind==="inverter")} />}
      {interior && <InteriorPlanner prices={interiorPrices(service.details.interior_prices)} whatsapp={whatsapp}
        accountId={account?.user.email_confirmed_at ? account.user.id : null} />}
      {quotePrices && <NetworkStudio key={typeof query.review === "string" ? query.review : "draft"} prices={quotePrices} whatsapp={whatsapp}
        accountId={account?.user.email_confirmed_at ? account.user.id : null} reviewPlan={reviewPlan} equipment={equipment} />}
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
