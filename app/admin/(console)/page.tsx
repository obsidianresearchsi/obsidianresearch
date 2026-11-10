import Link from "next/link";
import { PortalTitle, Metrics } from "@/components/portal";
import { Badge, ButtonLink, Notice } from "@/components/ui";
import { financeAccounts } from "@/lib/admin-data";
import { calendar, CONTENT, FINANCE, METHOD_LABELS, money, OPERATIONS, shortReference, STATUS_LABELS, type Payment } from "@/lib/model";
import { requireStaff } from "@/lib/supabase";

export default async function AdminOverview() {
  const { db, role } = await requireStaff();
  const ops = OPERATIONS.includes(role);
  const finance = FINANCE.includes(role);
  const count = (table: string, status?: string[]) => {
    const q = db.from(table).select("*",{count:"exact",head:true});
    return status ? q.in("status",status) : q;
  };
  const [total,pending,approved,enrolled,active,upcoming,accounts,recent,inbox,enquiries] = await Promise.all([
    ops ? count("applications") : null,
    ops ? count("applications",["submitted","under_review"]) : null,
    ops ? count("applications",["approved","awaiting_payment","payment_confirmed"]) : null,
    ops ? count("students") : null,
    db.from("courses").select("id",{count:"exact",head:true}).eq("archived",false).eq("published",true).eq("phase","running"),
    db.from("courses").select("id,title,starts_at,phase",{count:"exact"}).eq("archived",false).eq("published",true)
      .in("phase",["upcoming","starting_soon"]).order("starts_at",{nullsFirst:false}).limit(8),
    finance ? financeAccounts(db) : null,
    finance ? db.from("payments").select("*").order("created_at",{ascending:false}).limit(8) : null,
    ops ? count("customer_threads",["open","in_review"]) : null,
    CONTENT.includes(role) ? db.from("contact_enquiries").select("id",{count:"exact",head:true}).eq("resolved",false) : null,
  ]);
  const metrics: [string, string|number][] = [];
  if (ops) metrics.push(["Total applications",total?.count ?? 0],["Pending review",pending?.count ?? 0],
    ["Approval & payment",approved?.count ?? 0],["Enrolled students",enrolled?.count ?? 0]);
  metrics.push(["Active programs",active.count ?? 0],["Upcoming programs",upcoming.count ?? 0]);
  if (accounts) metrics.push(
    ["Confirmed payments",money(accounts.items.reduce((sum,a) => sum+a.paid_kobo,0))],
    ["Outstanding balances",money(accounts.items.reduce((sum,a) => sum+Math.max(0,a.payable_kobo-a.paid_kobo),0))],
  );
  const counts = [
    ["Pending review",pending?.count ?? 0],["Approved",approved?.count ?? 0],["Enrolled",enrolled?.count ?? 0],
  ] as const;
  const scale = Math.max(1,...counts.map(([, n]) => n));
  const transactions = (recent?.data ?? []) as Payment[];
  return <>
    <PortalTitle title="Management overview" action={ops ? <ButtonLink href="/admin/applications">Review applications</ButtonLink>
      : finance ? <ButtonLink href="/admin/finance">Open finance</ButtonLink> : undefined}>Training operations and payment activity.</PortalTitle>
    {(total?.error || active.error || upcoming.error || accounts?.error || recent?.error) && <Notice tone="error">Some metrics could not be loaded.</Notice>}
    {(ops || CONTENT.includes(role)) && <section className="panel stack"><h2>Work queue</h2><div className="workspace-shortcuts">
      {ops && <><Link className="workspace-shortcut" href="/admin/inbox"><span><strong>Customer inbox</strong><small>{inbox?.error ? "Count unavailable" : `${inbox?.count ?? 0} open or under review`}</small></span></Link>
        <Link className="workspace-shortcut" href="/admin/materials"><span><strong>Course materials</strong><small>Upload files for enrolled students</small></span></Link></>}
      {CONTENT.includes(role) && <><Link className="workspace-shortcut" href="/admin/enquiries"><span><strong>Contact enquiries</strong><small>{enquiries?.error ? "Count unavailable" : `${enquiries?.count ?? 0} unresolved`}</small></span></Link>
        <Link className="workspace-shortcut" href="/admin/equipment"><span><strong>Studio equipment</strong><small>Manage models and quote prices</small></span></Link></>}
    </div></section>}
    <Metrics items={metrics} />
    <div className="split split-even">
      {ops && <section className="panel"><h2>Application pipeline</h2><div className="bar-chart">
        {counts.map(([label,value]) => <div className="chart-item" key={label}><span>{label}</span>
          <div className="chart-track" aria-hidden><div className="chart-fill" style={{width:`${value/scale*100}%`}} /></div><b>{value}</b>
        </div>)}</div></section>}
      <section className="panel"><h2>Upcoming classes</h2>
        {upcoming.data?.length ? <div className="stack">{upcoming.data.map((course) => <div key={course.id}>
          {ops ? <Link href={`/admin/courses/${course.id}`} className="text-link">{course.title}</Link> : <strong>{course.title}</strong>}
          <p className="small muted">{calendar(course.starts_at)}</p>
        </div>)}</div> : <p className="muted">No upcoming classes are published.</p>}
      </section>
    </div>
    {finance && <section className="panel"><div className="panel-title"><h2>Recent transactions</h2><Link className="text-link" href="/admin/finance">Finance ledger</Link></div>
      {transactions.length ? <div className="table-scroll"><table><thead><tr><th>Reference</th><th>Method</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>{transactions.map((p) => <tr key={p.id}><td className="reference">{shortReference(p.reference)}</td>
          <td>{METHOD_LABELS[p.method]}</td><td>{money(p.amount_kobo)}</td><td><Badge tone={p.status==="confirmed"?"green":"neutral"}>{p.status}</Badge></td>
          <td>{calendar(p.created_at)}</td></tr>)}</tbody></table></div> : <p className="muted">Transactions appear here after checkout or manual recording.</p>}
    </section>}
    {CONTENT.includes(role) && <section className="panel"><h2>Website content</h2>
      <Link href="/admin/content" className="text-link">Edit services, announcements, FAQs and company information</Link>
    </section>}
  </>;
}
