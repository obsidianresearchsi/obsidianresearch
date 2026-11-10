import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { CONTENT_KINDS, type ContentKind } from "@/components/admin-editors";
import { PortalTitle } from "@/components/portal";
import { Badge, ButtonLink, DataList, Empty, Field, Notice, Select, Textarea } from "@/components/ui";
import { manageStaff, reconcilePayment, recordPayment, resolveEnquiry, retryEnquiryEmail, savePaymentInstructions, updateEnrollment } from "@/app/admin/actions";
import { applicationQuery, filters, financeAccounts, param, paymentQuery, type Query } from "@/lib/admin-data";
import { calendar, CONTENT, courseState, FINANCE, METHOD_LABELS, money, OPERATIONS, ROLE_LABELS, ROLES, shortReference,
  STATUSES, STATUS_LABELS, type Application, type Batch, type Content, type Course, type Enrollment,
  type FinanceAccount, type Payment, type Role } from "@/lib/model";
import { requireStaff } from "@/lib/supabase";

type PageProps = { params: Promise<{ section: string }>; searchParams: Promise<Query> };
const pageNumber = (query: Query) => Math.min(10000, Math.max(1, Number.parseInt(param(query,"page") ?? "1",10) || 1));
const qs = (query: Query) => new URLSearchParams(Object.entries(query).flatMap(([key,value]) => typeof value === "string" && key !== "page" ? [[key,value]] : []));

function Pages({ path, query, count, size=30 }: { path:string; query:Query; count:number; size?:number }) {
  const page = pageNumber(query);
  const href = (n:number) => { const search = qs(query); search.set("page",String(n)); return `${path}?${search}`; };
  return <nav className="row mt-3" aria-label="Results pages">
    {page > 1 && <Link className="text-link" href={href(page-1)}>Previous</Link>}
    <span className="small muted">Page {page} · {count} records</span>
    {count > page*size && <Link className="text-link" href={href(page+1)}>Next</Link>}
  </nav>;
}

async function Courses() {
  const { db } = await requireStaff(OPERATIONS);
  const result = await db.from("courses").select("*").order("created_at",{ascending:false});
  const rows = (result.data ?? []) as Course[];
  return <><PortalTitle title="Courses" action={<ButtonLink href="/admin/courses/new">Create course</ButtonLink>}>Manage fees, registration capacity, and coupons. Open a course to manage its offers.</PortalTitle>
    <section className="panel">{result.error && <Notice tone="error">Courses could not be loaded.</Notice>}
      {rows.length ? <div className="table-scroll"><table><thead><tr><th>Program</th><th>Visibility</th><th>Intake</th><th>Fee</th><th>Reserved</th></tr></thead>
        <tbody>{rows.map((c) => <tr key={c.id}><td><Link href={`/admin/courses/${c.id}`}>{c.title}</Link><br /><span className="muted">{c.category}</span></td>
          <td><Badge tone={c.published && !c.archived ? "green" : "neutral"}>{c.archived ? "Archived" : c.published ? "Published" : "Draft"}</Badge></td>
          <td>{courseState(c).label}</td><td>{money(c.fee_kobo)}</td><td>{c.reserved_count}{c.capacity ? ` / ${c.capacity}` : ""}</td></tr>)}</tbody>
      </table></div> : <Empty title="No courses yet">Create a course to start building the catalogue.</Empty>}
    </section></>;
}

async function Applications({ query }: { query:Query }) {
  const { db } = await requireStaff(OPERATIONS);
  const f = filters(query);
  const start = (pageNumber(query)-1)*30;
  const [courseResult,result] = await Promise.all([
    db.from("courses").select("id,title").order("title"),
    applicationQuery(db,query,"id,reference,full_name,status,created_at,courses(title)").range(start,start+29),
  ]);
  const rows = (result.data ?? []) as unknown as (Pick<Application,"id"|"reference"|"full_name"|"status"|"created_at"> & { courses:{title:string}|null })[];
  return <><PortalTitle title="Applications" action={<ButtonLink href={`/admin/export/applications?${qs(query)}`} variant="ghost">Export CSV</ButtonLink>}>
    Review submissions, assign batches and approve registrations.</PortalTitle>
    <section className="panel"><form className="filter-form" action="/admin/applications">
      <Field name="q" label="Applicant name" defaultValue={f.search} maxLength={100} />
      <Select name="course" label="Course" defaultValue={f.course}><option value="">All courses</option>{courseResult.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
      <Select name="status" label="Status" defaultValue={f.status}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</Select>
      <button className="button button-dark" type="submit">Filter</button>
    </form>{result.error && <Notice tone="error">Application records could not be loaded.</Notice>}
    {rows.length ? <div className="table-scroll"><table><thead><tr><th>Applicant</th><th>Course</th><th>Status</th><th>Date</th><th>Reference</th></tr></thead>
      <tbody>{rows.map((a) => <tr key={a.id}><td><Link href={`/admin/applications/${a.id}`}>{a.full_name}</Link></td>
        <td>{a.courses?.title}</td><td><Badge tone={a.status==="enrolled"?"green":"blue"}>{STATUS_LABELS[a.status]}</Badge></td>
        <td>{calendar(a.created_at)}</td><td className="reference">{shortReference(a.reference)}</td></tr>)}</tbody></table></div>
      : <Empty title="No applications match these filters" />}
    <Pages path="/admin/applications" query={query} count={result.count ?? 0} /></section>
  </>;
}

async function Students({ query }: { query: Query }) {
  const { db } = await requireStaff(OPERATIONS);
  const start = (pageNumber(query)-1)*30;
  const [enrollments,batches] = await Promise.all([
    db.from("enrollments").select("*,students(student_number),applications(id,full_name,email),courses(title)",{count:"exact"})
      .order("created_at",{ascending:false}).order("id").range(start,start+29),
    db.from("course_batches").select("*").order("name"),
  ]);
  const rows = (enrollments.data ?? []) as unknown as (Enrollment & {
    students:{ student_number:string } | null; applications:{ id:string; full_name:string; email:string } | null; courses:{ title:string } | null;
  })[];
  return <><PortalTitle title="Student records">Manage confirmed enrolments, student IDs and training batches.</PortalTitle>
    {enrollments.error && <Notice tone="error">Student records could not be loaded.</Notice>}
    {rows.length ? rows.map((item) => <section className="panel" key={item.id}>
      <div className="panel-title"><h2>{item.applications?.full_name ?? "Student"}</h2><Badge tone={item.status==="active"?"green":"neutral"}>{item.status}</Badge></div>
      <DataList items={[["Student ID",item.students?.student_number ?? "—"],["Email",item.applications?.email ?? "—"],["Program",item.courses?.title ?? "—"],["Registered",calendar(item.created_at)]]} />
      <div className="row mt-3"><Link className="text-link" href={`/admin/applications/${item.application_id}`}>Application record and documents</Link></div>
      <details className="mt-3"><summary>Update enrolment</summary><div className="mt-3">
        <ActionForm action={updateEnrollment} submit="Save enrolment" tone="dark"><input type="hidden" name="id" value={item.id} />
          <div className="form-grid"><Select name="status" label="Enrolment status" defaultValue={item.status}><option value="active">Active</option><option value="completed">Completed</option><option value="withdrawn">Withdrawn</option></Select>
            <Select name="batch" label="Assigned batch" defaultValue={item.batch_id ?? ""}><option value="">Unassigned</option>
              {((batches.data ?? []) as Batch[]).filter((b) => b.course_id===item.course_id).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></div>
        </ActionForm>
      </div></details>
    </section>) : <Empty title="No students enrolled yet">Enrol a payment-confirmed applicant in Applications.</Empty>}
    <Pages path="/admin/students" query={query} count={enrollments.count ?? 0} />
  </>;
}

async function Finance({ query }: { query:Query }) {
  const { db } = await requireStaff(FINANCE);
  const f = filters(query);
  const [accounts, courses, settings] = await Promise.all([
    financeAccounts(db),db.from("courses").select("id,title").order("title"),
    db.from("payment_settings").select("cash_instructions,transfer_instructions").maybeSingle(),
  ]);
  const filtered = accounts.items.filter((a) => (!f.course || a.course_id===f.course) &&
    (!f.search || a.full_name.toLowerCase().includes(f.search.toLowerCase()) || a.reference.toLowerCase().includes(f.search.toLowerCase())));
  const start = (pageNumber(query)-1)*30;
  const idFilter = f.course || f.search ? filtered.map((a) => a.id) : undefined;
  const transactions = idFilter?.length === 0 ? { data:[], count:0, error:null }
    : await paymentQuery(db,query,idFilter).range(start,start+29);
  const rows = (transactions.data ?? []) as (Payment & { payment_receipts:{ receipt_number:string } | { receipt_number:string }[] | null })[];
  const map = new Map(accounts.items.map((a) => [a.id,a]));
  return <><PortalTitle title="Finance" action={<ButtonLink href={`/admin/export/finance?${qs(query)}`} variant="ghost">Export CSV</ButtonLink>}>
    Confirm offline payments, reconcile Flutterwave and track balances.</PortalTitle>
    {(transactions.error || accounts.error) && <Notice tone="error">Some finance records could not be loaded.</Notice>}
    <section className="panel"><h2>Transaction ledger</h2><form className="filter-form" action="/admin/finance">
      <Field name="q" label="Student or reference" defaultValue={f.search} maxLength={100} />
      <Select name="course" label="Course" defaultValue={f.course}><option value="">All courses</option>{courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
      <Select name="payment_status" label="Payment status" defaultValue={param(query,"payment_status") ?? ""}><option value="">All statuses</option>
        {["pending","confirmed","cancelled"].map((s) => <option key={s}>{s}</option>)}</Select>
      <div />
      <Field name="from" label="From date" type="date" defaultValue={f.from} /><Field name="to" label="To date" type="date" defaultValue={f.to} />
      <button className="button button-dark" type="submit">Filter ledger</button>
    </form>
    {rows.length ? <div className="table-scroll"><table><thead><tr><th>Student</th><th>Reference</th><th>Method</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead>
      <tbody>{rows.map((p) => { const receipt = Array.isArray(p.payment_receipts) ? p.payment_receipts[0] : p.payment_receipts;
        return <tr key={p.id}><td>{map.get(p.application_id)?.full_name || "Applicant"}<br /><span className="small muted">{calendar(p.created_at)}</span></td>
          <td className="reference"><details><summary>{shortReference(p.reference)}</summary><span>{p.reference}</span></details></td><td>{METHOD_LABELS[p.method]}</td>
          <td>{money(p.amount_kobo)}</td><td><Badge tone={p.status==="confirmed"?"green":"neutral"}>{p.status}</Badge></td>
          <td className="reference" title={receipt?.receipt_number}>{receipt ? shortReference(receipt.receipt_number) : "—"}</td></tr>;
      })}</tbody></table></div> : <p className="muted">No transactions match these filters.</p>}
    <Pages path="/admin/finance" query={query} count={transactions.count ?? 0} /></section>
    <div className="split split-even">
      <section className="panel"><h2>Record an offline payment</h2>
        <ActionForm action={recordPayment} submit="Confirm payment" tone="dark" confirm="Confirm that you received and verified these funds?">
          <Select name="id" label="Approved application" required><option value="">Select an application</option>
            {filtered.filter((a) => a.payable_kobo>a.paid_kobo && ["approved","awaiting_payment"].includes(a.status)).map((a) =>
              <option key={a.id} value={a.id}>{a.full_name} · {shortReference(a.reference)} · {money(a.payable_kobo-a.paid_kobo)}</option>)}</Select>
          <Select name="method" label="Method"><option value="cash">Cash</option><option value="transfer">Bank transfer</option></Select>
          <Field name="amount" label="Amount received (NGN)" inputMode="decimal" required />
          <Field name="reference" label="Verified receipt or bank reference" maxLength={160} required />
        </ActionForm>
      </section>
      <section className="panel"><h2>Verify an online transaction</h2>
        <p className="small muted">Review late charges, mismatched amounts and duplicate events in the payment audit.</p>
        <Link className="text-link" href="/admin/audit?entity=payments">Open payment audit</Link>
        <ActionForm action={reconcilePayment} submit="Verify with Flutterwave" tone="dark">
          <Field name="reference" label="Full checkout reference" maxLength={36} required />
          <Field name="transaction" label="Flutterwave transaction ID" inputMode="numeric" maxLength={30} required />
        </ActionForm>
      </section>
    </div>
    <section className="panel"><h2>Application balances</h2>
      {filtered.length ? <div className="table-scroll"><table><thead><tr><th>Student</th><th>Course</th><th>Payable</th><th>Paid</th><th>Outstanding</th><th>Reported transfer reference</th></tr></thead>
        <tbody>{filtered.slice(0,100).map((a: FinanceAccount) => <tr key={a.id}><td>{a.full_name}</td><td>{a.course_title}</td><td>{money(a.payable_kobo)}</td>
          <td>{money(a.paid_kobo)}</td><td>{money(Math.max(0,a.payable_kobo-a.paid_kobo))}</td><td>{a.transfer_reference ?? "—"}</td></tr>)}</tbody></table></div> :
        <p className="muted">Approved applications will appear here.</p>}
    </section>
    <section className="panel"><h2>Private payment instructions</h2>
      <ActionForm action={savePaymentInstructions} submit="Save instructions" tone="dark">
        <Textarea name="cash_instructions" label="Cash instructions" defaultValue={settings.data?.cash_instructions} maxLength={1000} required />
        <Textarea name="transfer_instructions" label="Bank transfer instructions" defaultValue={settings.data?.transfer_instructions} maxLength={1000} required />
        <p className="small muted">Students see these instructions after approval. Verify any account details before saving them.</p>
      </ActionForm>
    </section>
  </>;
}

async function ContentList({ query }: { query: Query }) {
  const { db } = await requireStaff(CONTENT);
  const kind = param(query,"kind");
  const category = kind && Object.hasOwn(CONTENT_KINDS,kind) ? kind as ContentKind : null;
  const start = (pageNumber(query)-1)*30;
  let listQuery = db.from("site_content").select("id,kind,title,published,updated_at",{count:"exact"});
  if (category) listQuery = listQuery.eq("kind",category);
  const result = await listQuery.order("kind").order("position").order("updated_at",{ascending:false}).order("id").range(start,start+29);
  const list = (result.data ?? []) as Pick<Content,"id"|"kind"|"title"|"published"|"updated_at">[];
  return <><PortalTitle title="Website content">Manage services, estimator prices, portfolio projects and journal articles.</PortalTitle>
    <section className="panel stack"><h2>Add content</h2><div className="row">{Object.entries(CONTENT_KINDS).filter(([kind]) => kind!=="company")
      .map(([kind,label]) => <ButtonLink href={`/admin/content/new?kind=${kind}`} key={kind} variant="ghost" arrow="none">{label}</ButtonLink>)}</div></section>
    <section className="panel"><div className="panel-title"><h2>{category ? CONTENT_KINDS[category] : "All content"}</h2>
      <nav aria-label="Content type" className="row">
        <Link className="text-link" aria-current={!category ? "page" : undefined} href="/admin/content">All</Link>
        <Link className="text-link" aria-current={category==="service" ? "page" : undefined} href="/admin/content?kind=service">Services</Link>
        <Link className="text-link" aria-current={category==="article" ? "page" : undefined} href="/admin/content?kind=article">Journal</Link>
        <Link className="text-link" aria-current={category==="portfolio" ? "page" : undefined} href="/admin/content?kind=portfolio">Portfolio</Link>
      </nav></div>
      {result.error && <Notice tone="error">Site content could not be loaded.</Notice>}
      {list.length ? <div className="table-scroll"><table><thead><tr><th>Title</th><th>Type</th><th>Visibility</th><th>Updated</th></tr></thead>
        <tbody>{list.map((item) => <tr key={item.id}><td><Link href={`/admin/content/${item.id}`}>{item.title}</Link></td>
          <td>{CONTENT_KINDS[item.kind as ContentKind]}</td><td><Badge tone={item.published?"green":"neutral"}>{item.published?"Published":"Draft"}</Badge></td>
          <td>{calendar(item.updated_at)}</td></tr>)}</tbody></table></div> : <Empty title="No content here yet" />}
      <Pages path="/admin/content" query={query} count={result.count ?? 0} />
    </section></>;
}

async function Enquiries({ query }: { query:Query }) {
  const { db } = await requireStaff(CONTENT);
  const start = (pageNumber(query)-1)*30;
  const result = await db.from("contact_enquiries").select("id,full_name,email,topic,message,resolved,created_at,notification_status",{count:"exact"})
    .order("created_at",{ascending:false}).order("id").range(start,start+29);
  return <><PortalTitle title="Enquiry inbox">Review contact requests from the public website.</PortalTitle>
    {result.error && <Notice tone="error">The enquiry inbox could not be loaded.</Notice>}
    {result.data?.length ? result.data.map((item) => <section className="panel" key={item.id}>
      <div className="panel-title"><h2>{item.topic}</h2><Badge tone={item.resolved?"green":"blue"}>{item.resolved?"Resolved":"Open"}</Badge></div>
      <p className="small muted">{item.full_name} · {item.email} · {calendar(item.created_at)}</p>
      <p className="whitespace-pre-line">{item.message}</p>
      <p className="small muted">Admin email · {({
        sent: "Accepted by mail provider", queued: "Awaiting notification", failed: "Send failed",
        unconfigured: "Mail sender not configured",
      } as Record<string, string>)[item.notification_status] ?? "Unknown"}</p>
      <a className="text-link" href={`mailto:${item.email}?subject=${encodeURIComponent(`Re: ${item.topic}`)}`}>Reply by email</a>
      <div className="mt-3"><ActionForm action={resolveEnquiry} submit={item.resolved?"Reopen enquiry":"Mark resolved"} tone="dark">
        <input type="hidden" name="id" value={item.id} /><input type="hidden" name="resolved" value={String(!item.resolved)} />
      </ActionForm></div>
      {!item.resolved && item.notification_status !== "sent" && Date.now() - Date.parse(item.created_at) < 23 * 60 * 60 * 1000 &&
        <div className="mt-3"><ActionForm action={retryEnquiryEmail} submit="Retry admin email" tone="dark">
          <input type="hidden" name="id" value={item.id} />
        </ActionForm></div>}
    </section>) : <Empty title="No enquiries yet">Requests submitted through the contact form will appear here.</Empty>}
    <Pages path="/admin/enquiries" query={query} count={result.count ?? 0} /></>;
}

async function Staff() {
  const { db } = await requireStaff(["super_admin"]);
  const result = await db.rpc("staff_directory");
  const list = (result.data ?? []) as { user_id:string;email:string;full_name:string;role:Role }[];
  return <><PortalTitle title="Staff access">Assign roles to existing, email-confirmed accounts.</PortalTitle>
    {result.error && <Notice tone="error">The staff directory could not be loaded.</Notice>}
    <section className="panel"><h2>Staff directory</h2>
      <div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>
        {list.map((item) => <tr key={item.user_id}><td>{item.full_name || "—"}</td><td>{item.email}</td><td>{ROLE_LABELS[item.role]}</td></tr>)}
      </tbody></table></div>
    </section>
    <section className="panel"><h2>Assign or revoke access</h2><ActionForm action={manageStaff} submit="Update access" tone="dark" confirm="Apply this change to staff permissions?">
      <Field name="email" label="Confirmed staff email" type="email" required />
      <Select name="role" label="Role"><option value="">Revoke staff access</option>{ROLES.map((role) => <option value={role} key={role}>{ROLE_LABELS[role]}</option>)}</Select>
    </ActionForm></section>
  </>;
}

async function Audit({ query }: { query:Query }) {
  const { db } = await requireStaff(FINANCE);
  const start = (pageNumber(query)-1)*30;
  const entity = param(query,"entity");
  const base = db.from("audit_logs").select("*",{count:"exact"}).order("id",{ascending:false});
  const result = await (entity === "payments" || entity === "contact_enquiries" ? base.eq("entity",entity) : base).range(start,start+29);
  return <><PortalTitle title="Audit history">Review staff changes and payment events permitted by your role.</PortalTitle>
    <section className="panel">{result.error && <Notice tone="error">Audit events could not be loaded.</Notice>}
      {result.data?.length ? <div className="table-scroll"><table><thead><tr><th>Date</th><th>Entity</th><th>Action</th><th>Reference</th><th>Actor</th><th>Details</th></tr></thead>
        <tbody>{result.data.map((event) => <tr key={event.id}><td>{calendar(event.created_at)}</td><td>{event.entity}</td>
          <td>{event.action === "flutterwave_balance_review" ? <Badge tone="gold">Charge requires balance review</Badge> : event.action}</td>
          <td className="reference">{event.entity_id ? shortReference(event.entity_id) : "—"}</td>
          <td className="reference">{event.actor_id ? shortReference(event.actor_id) : "System"}</td>
          <td><code>{JSON.stringify(event.detail)}</code></td></tr>)}</tbody></table></div>
        : <Empty title="No audit records for this role" />}
      <Pages path="/admin/audit" query={query} count={result.count ?? 0} />
    </section></>;
}

export default async function AdminSection({ params, searchParams }: PageProps) {
  const [{ section },query] = await Promise.all([params,searchParams]);
  switch (section) {
    case "courses": return <Courses />;
    case "applications": return <Applications query={query} />;
    case "students": return <Students query={query} />;
    case "finance": return <Finance query={query} />;
    case "content": return <ContentList query={query} />;
    case "enquiries": return <Enquiries query={query} />;
    case "staff": return <Staff />;
    case "audit": return <Audit query={query} />;
    default: notFound();
  }
}
