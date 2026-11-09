import Link from "next/link";
import { ThreadList } from "@/components/conversations";
import { PortalTitle } from "@/components/portal";
import { Empty, Notice } from "@/components/ui";
import { OPERATIONS, type CustomerThread } from "@/lib/model";
import { requireStaff } from "@/lib/supabase";

export default async function Inbox({ searchParams }: { searchParams:Promise<{ view?:string;page?:string }> }) {
  const [{ db },{ view,page:rawPage }] = await Promise.all([requireStaff(OPERATIONS),searchParams]);
  const page = Math.max(1, Math.min(1000, Number.parseInt(rawPage ?? "",10) || 1));
  let query = db.from("customer_threads").select("*",{count:"exact"}).order("updated_at",{ascending:false}).order("id");
  if (view === "services") query = query.not("service_id","is",null);
  if (view === "support") query = query.is("service_id",null);
  const { data,error,count } = await query.range((page-1)*30,page*30-1);
  const items = (data ?? []) as CustomerThread[];
  const profiles = items.length ? await db.from("profiles").select("id,full_name").in("id",[...new Set(items.map((item) => item.user_id))]) : null;
  const names = Object.fromEntries((profiles?.data ?? []).map((item) => [item.id,item.full_name]));
  const pageHref = (number: number) => `/admin/inbox?view=${view === "services" || view === "support" ? view : "all"}&page=${number}`;
  return <>
    <PortalTitle title="Customer inbox">Review service requests, update their status, and reply to customers.</PortalTitle>
    <section className="panel stack">
      <div className="row">
        <Link className="button button-ghost" href="/admin/inbox">All conversations</Link>
        <Link className="button button-ghost" href="/admin/inbox?view=services">Service requests</Link>
        <Link className="button button-ghost" href="/admin/inbox?view=support">Support chats</Link>
      </div>
      {error ? <Notice tone="error">Could not load conversations.</Notice> :
        items.length ? <ThreadList items={items} names={names} base="/admin/inbox" /> : <Empty title="No conversations here yet" />}
      <div className="row">
        {page>1 && <Link className="text-link" href={pageHref(page-1)}>Previous</Link>}
        {(count ?? 0)>page*30 && <Link className="text-link" href={pageHref(page+1)}>Next</Link>}
      </div>
    </section>
  </>;
}
