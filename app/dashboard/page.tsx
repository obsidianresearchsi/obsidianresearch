import Link from "next/link";
import { ArrowUpRight, BookOpen, BriefcaseBusiness, GraduationCap, MessagesSquare } from "lucide-react";
import { ThreadList } from "@/components/conversations";
import { Badge, ButtonLink, Empty, Notice } from "@/components/ui";
import { Metrics } from "@/components/portal";
import { calendar, money, shortReference, STATUS_LABELS, type Application, type CustomerThread, type Enrollment, type Payment, type Student } from "@/lib/model";
import { requireStudent } from "@/lib/supabase";

const shortcuts = [
  { href:"/dashboard/apply", label:"Apply for training", description:"Choose a program and apply in My Workspace.", Icon:GraduationCap },
  { href:"/dashboard/services", label:"Request a service", description:"Explore our services and track your requests.", Icon:BriefcaseBusiness },
  { href:"/dashboard/messages", label:"Message our team", description:"Ask a question or follow up on a request.", Icon:MessagesSquare },
];

export default async function Dashboard() {
  const { db, user } = await requireStudent();
  const [profile, applications, student, enrollment, notifications, threads] = await Promise.all([
    db.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    db.from("applications").select("*,courses(title)").eq("user_id", user.id).order("created_at", { ascending: false }),
    db.from("students").select("*").eq("user_id", user.id).maybeSingle(),
    db.from("enrollments").select("*,courses(title),course_batches(name)").eq("user_id", user.id).order("created_at", { ascending: false }),
    db.from("notifications").select("id,title,body,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(6),
    db.from("customer_threads").select("*").eq("user_id",user.id).order("updated_at",{ascending:false}).limit(4),
  ]);
  const list = (applications.data ?? []) as (Application & { courses: { title: string } | null })[];
  const enrolments = (enrollment.data ?? []) as (Enrollment & { courses: { title: string } | null; course_batches: { name: string } | null })[];
  const id = student.data as Student | null;
  const payment = list.length ? await db.from("payments").select("application_id,amount_kobo,status")
    .in("application_id",list.map((a) => a.id)).eq("status","confirmed") : { data: [], error: null };
  const paid = (payment.data ?? []) as Pick<Payment,"application_id"|"amount_kobo"|"status">[];
  const amountDue = list.filter((a) => ["approved","awaiting_payment"].includes(a.status)).reduce((sum, a) =>
    sum + Math.max(0, a.payable_kobo - paid.filter((p) => p.application_id === a.id).reduce((value,p) => value+p.amount_kobo,0)),0);
  const name = profile.data?.full_name?.trim().split(/\s+/)[0];
  const conversations = (threads.data ?? []) as CustomerThread[];
  return <>
    <header className="workspace-hero">
      <p className="eyebrow"><span aria-hidden /> My Obsidian workspace</p>
      <h1>{name ? `Welcome, ${name}` : "Welcome to Obsidian"}</h1>
      <p>Manage your training, book services, and talk to our team from one account.</p>
      <div className="workspace-account"><span>{user.email}</span>{id && <span>Student ID {id.student_number}</span>}</div>
    </header>
    <section className="workspace-shortcuts" aria-label="Quick actions">
      {shortcuts.map(({href,label,description,Icon}) => <Link key={href} href={href} className="workspace-shortcut">
        <span className="thread-icon"><Icon size={20} aria-hidden /></span>
        <span><strong>{label}</strong><small>{description}</small></span>
        <ArrowUpRight size={16} aria-hidden />
      </Link>)}
    </section>
    {(applications.error || enrollment.error || payment.error) && <Notice tone="error">Some records could not be loaded. Refresh the page or contact the centre.</Notice>}
    <Metrics items={[["Applications",list.length],["Enrolments",enrolments.length],["Balance due",money(amountDue)]]} />
    <section className="panel">
      <div className="panel-title"><h2>Recent conversations</h2><Link className="text-link" href="/dashboard/messages">Open inbox <ArrowUpRight size={15} aria-hidden /></Link></div>
      {threads.error ? <Notice tone="error">Could not load conversations. Refresh to try again.</Notice> :
        conversations.length ? <ThreadList items={conversations} base="/dashboard/messages" /> :
          <p className="muted">Service requests and support chats will appear here.</p>}
    </section>
    <section className="panel"><div className="panel-title"><h2>My applications</h2><Link className="text-link" href="/dashboard/apply">New application <ArrowUpRight size={15} aria-hidden /></Link></div>
      {list.length ? <div className="table-scroll"><table><thead><tr><th>Program</th><th>Reference</th><th>Status</th><th>Submitted</th><th>Details</th></tr></thead>
        <tbody>{list.map((a) => <tr key={a.id}><td>{a.courses?.title || "Training program"}</td><td className="reference">{shortReference(a.reference)}</td>
          <td><Badge tone={a.status === "enrolled" || a.status === "payment_confirmed" ? "green" : "blue"}>{STATUS_LABELS[a.status]}</Badge></td>
          <td>{calendar(a.created_at)}</td><td><Link href={`/dashboard/applications/${a.id}`}>View <ArrowUpRight className="inline" size={13} aria-hidden /></Link></td></tr>)}</tbody>
      </table></div> : <Empty title="You haven’t applied yet">Choose a program to start your application.<br /><ButtonLink href="/dashboard/apply">Browse training</ButtonLink></Empty>}
    </section>
    <section className="panel"><h2>My enrolments</h2>
      {id && <p className="small muted">Student ID <span className="reference">{id.student_number}</span></p>}
      {enrolments.length ? <div className="table-scroll"><table><thead><tr><th>Program</th><th>Batch</th><th>Enrolment status</th><th>Registered</th></tr></thead>
        <tbody>{enrolments.map((e) => <tr key={e.id}><td>{e.courses?.title || "Training program"}</td><td>{e.course_batches?.name || "To be assigned"}</td>
          <td><Badge tone={e.status === "active" ? "green" : "neutral"}>{e.status}</Badge></td><td>{calendar(e.created_at)}</td></tr>)}</tbody></table></div>
        : <p className="muted">Confirmed enrolments will appear here when the training centre assigns your place.</p>}
    </section>
    <div className="split split-even">
      <section className="panel"><h2>Recent activity</h2>
        {notifications.data?.length ? <div className="stack">{notifications.data.map((n) => <div key={n.id}>
          {n.title === "New course material" ? <Link className="text-link" href="/dashboard/documents">{n.title}</Link> : <strong>{n.title}</strong>}
          <p className="small muted">{n.title === "New course material" ? n.body : shortReference(n.body)} · {calendar(n.created_at)}</p></div>)}</div> : <p className="muted">No updates yet.</p>}
      </section>
      <section className="panel"><h2 className="row"><BookOpen size={21} aria-hidden />Course materials & guidelines</h2>
        <p className="muted">Find files for your enrolled courses and read the student rules and training agreement.</p>
        <div className="mt-4"><ButtonLink href="/dashboard/documents" variant="dark">View documents</ButtonLink></div>
      </section>
    </div>
  </>;
}
