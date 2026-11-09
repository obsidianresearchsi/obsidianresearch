import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { startConversation } from "@/app/dashboard/conversation-actions";
import { ActionForm } from "@/components/action-form";
import { ServiceIcon } from "@/components/catalog";
import { ThreadList } from "@/components/conversations";
import { PortalTitle } from "@/components/portal";
import { Empty, Notice, Textarea } from "@/components/ui";
import { catalog } from "@/lib/catalog";
import { money, servicePrice, type CustomerThread } from "@/lib/model";
import { SOLAR_SERVICE } from "@/lib/solar";
import { requireStudent } from "@/lib/supabase";

export default async function ServicesWorkspace({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const { service: slug } = await searchParams;
  const path = slug ? `/dashboard/services?service=${encodeURIComponent(slug)}` : "/dashboard/services";
  const [{ db,user }, { content, available }] = await Promise.all([requireStudent(path),catalog()]);
  const services = content.filter((item) => item.kind === "service");
  const selected = slug ? services.find((item) => item.slug === slug) : null;
  if (slug && !selected && available) notFound();
  const { data, error } = await db.from("customer_threads").select("*").eq("user_id",user.id).not("service_id","is",null)
    .order("updated_at",{ascending:false});
  const requests = (data ?? []) as CustomerThread[];
  const existing = selected && requests.find((item) => item.service_id===selected.id && !["closed","completed"].includes(item.status));
  if (existing) redirect(`/dashboard/messages/${existing.id}`);
  const price = selected ? servicePrice(selected) : null;
  return <>
    <PortalTitle title={selected ? `Request ${selected.title}` : "Services"}>
      {selected ? "Tell our team what you need. Replies will appear in your messages." : "Request a service with your existing account and track every conversation here."}
    </PortalTitle>
    {(error || !available) && <Notice tone="error">Some service information could not be loaded. Refresh to try again.</Notice>}
    {selected ? <section className="panel stack">
      <Link className="text-link" href="/dashboard/services">Back to services</Link>
      <p>{selected.summary}</p>
      <p><strong>{price === null ? "Quote on request" : money(price)}</strong></p>
      {selected.slug === SOLAR_SERVICE && <Link className="text-link" href={`/services/${SOLAR_SERVICE}#solar-estimator`}>Estimate your setup first <ArrowUpRight size={15} aria-hidden /></Link>}
      <ActionForm action={startConversation} submit="Send service request">
        <input type="hidden" name="service" value={selected.id} />
        <Textarea name="body" label="What do you need?" rows={5} maxLength={4000} required
          hint="Include the details that will help us prepare a response, such as location, timing, or which package you are interested in." />
      </ActionForm>
    </section> : <>
      <section className="panel stack"><h2>My service requests</h2>
        {requests.length ? <ThreadList items={requests} base="/dashboard/messages" /> :
          <Empty title="No service requests yet">Choose a service below to send your first request.</Empty>}
      </section>
      <section className="stack"><h2>Available services</h2>
        <div className="workspace-services">{services.map((item) => {
          const price = servicePrice(item);
          return <article className="panel stack" key={item.id}>
            <span className="thread-icon"><ServiceIcon slug={item.slug} size={19} /></span>
            <div><h3>{item.title}</h3><p className="muted small">{item.summary}</p></div>
            <strong>{price === null ? "Quote on request" : money(price)}</strong>
            <Link className="text-link" href={`/dashboard/services?service=${item.slug}`}>Request service <ArrowUpRight size={15} aria-hidden /></Link>
            {item.slug === SOLAR_SERVICE && <Link className="text-link" href={`/services/${SOLAR_SERVICE}#solar-estimator`}>Open solar estimator <ArrowUpRight size={15} aria-hidden /></Link>}
          </article>;
        })}</div>
      </section>
    </>}
  </>;
}
