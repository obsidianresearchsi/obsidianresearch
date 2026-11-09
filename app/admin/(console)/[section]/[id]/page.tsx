import Link from "next/link";
import { notFound } from "next/navigation";
import { compareIdentityNumber, reviewApplication, reviewIdentity } from "@/app/admin/actions";
import { ActionForm } from "@/components/action-form";
import { CONTENT_KINDS, ContentEditor, CourseEditor, type ContentKind } from "@/components/admin-editors";
import { PortalTitle } from "@/components/portal";
import { Badge, Breadcrumbs, ButtonLink, DataList, Field, Notice, Select, Textarea } from "@/components/ui";
import { param, type Query } from "@/lib/admin-data";
import { uuid } from "@/lib/forms";
import { calendar, CONTENT, FINANCE, METHOD_LABELS, money, OPERATIONS, REVIEW_OPTIONS, STATUS_LABELS,
  type Application, type Batch, type Content, type Course, type Discount, type Module } from "@/lib/model";
import { requireStaff } from "@/lib/supabase";

type PageProps = { params: Promise<{ section:string; id:string }>; searchParams: Promise<Query> };

async function CourseDetail({ id }: { id:string }) {
  const { db } = await requireStaff(OPERATIONS);
  const creating = id === "new";
  if (!creating && !uuid.safeParse(id).success) notFound();
  const [main, modules, batches, discounts] = creating ? [null,null,null,null] : await Promise.all([
    db.from("courses").select("*").eq("id",id).maybeSingle<Course>(),
    db.from("course_modules").select("*").eq("course_id",id).order("position"),
    db.from("course_batches").select("*").eq("course_id",id).order("starts_at").order("name"),
    db.from("discounts").select("*").eq("course_id",id).order("active",{ascending:false}),
  ]);
  if (!creating && !main?.data) notFound();
  const course = main?.data ?? undefined;
  return <><Breadcrumbs items={[{ label:"Courses",href:"/admin/courses" },{ label:course?.title || "New course" }]} />
    <PortalTitle title={course?.title || "Create a course"} action={course?.published && !course.archived
      ? <ButtonLink href={`/training/${course.slug}`} variant="ghost" arrow="up">View live listing</ButtonLink> : undefined}>
      {course ? `Current registration fee ${money(course.fee_kobo)}` : "Add a program to the academy catalogue."}
    </PortalTitle>
    {(modules?.error || batches?.error || discounts?.error) && <Notice tone="error">Some course settings could not be loaded.</Notice>}
    <CourseEditor course={course} modules={(modules?.data ?? []) as Module[]} batches={(batches?.data ?? []) as Batch[]}
      discounts={(discounts?.data ?? []) as Discount[]} />
  </>;
}

async function ApplicationDetail({ id }: { id:string }) {
  const { db,role } = await requireStaff(OPERATIONS);
  if (!uuid.safeParse(id).success) notFound();
  const [main,identity,notes] = await Promise.all([
    db.from("applications").select("*,courses(title)").eq("id",id).maybeSingle(),
    db.from("application_identity").select("photo_path,nin_ciphertext,verification_status,verified_at,consent_at").eq("application_id",id).maybeSingle(),
    db.from("application_notes").select("id,body,created_at").eq("application_id",id).order("created_at",{ascending:false}),
  ]);
  const app = main.data as (Application & { courses:{ title:string } | null }) | null;
  if (!app) notFound();
  const batches = await db.from("course_batches").select("id,name").eq("course_id",app.course_id).order("name");
  const privateDoc = identity.data;
  const photo = privateDoc?.photo_path ? (await db.storage.from("applicant-photos").createSignedUrl(privateDoc.photo_path,90)).data?.signedUrl : null;
  return <><Breadcrumbs items={[{ label:"Applications",href:"/admin/applications" },{ label:"Application review" }]} />
    <PortalTitle title={app.full_name} action={<Badge tone="blue">{STATUS_LABELS[app.status]}</Badge>}>
      {app.courses?.title} · <span className="reference">{app.reference}</span>
    </PortalTitle>
    <div className="split split-even">
      <section className="panel"><h2>Applicant record</h2><DataList items={[
        ["Email",app.email],["Phone",app.phone],["WhatsApp",app.whatsapp || "—"],["Date of birth",calendar(app.date_of_birth)],
        ["Gender",app.gender || "—"],["Address",app.address],["State",app.state],["Occupation",app.occupation],["Education",app.education],
        ["Additional information",app.additional_info || "—"],["Applied",calendar(app.created_at)],
      ]} /></section>
      <section className="panel stack"><h2>Review & batch assignment</h2>
        <ActionForm action={reviewApplication} submit="Save review" tone="dark" confirm="Save the selected application status and any internal note?">
          <input type="hidden" name="id" value={app.id} />
          <Select name="status" label="Application status" defaultValue={app.status}>
            {[app.status,...REVIEW_OPTIONS[app.status]].map((status) => <option value={status} key={status}>{STATUS_LABELS[status]}</option>)}
          </Select>
          <Select name="batch" label="Training batch" defaultValue={app.preferred_batch_id ?? ""}>
            <option value="">Keep current assignment</option>
            {batches.data?.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
          </Select>
          <Textarea label="Internal review note" name="note" maxLength={2000} rows={4} />
        </ActionForm>
      </section>
    </div>
    <div className="split split-even">
      <section className="panel stack"><h2>Restricted identity evidence</h2>
        {privateDoc ? <>
          <Badge tone={privateDoc.verification_status==="verified"?"green":"gold"}>{privateDoc.verification_status.replaceAll("_"," ")}</Badge>
          {photo ? <img className="photo-preview" src={photo} alt="Applicant’s passport photograph" referrerPolicy="no-referrer" />
            : privateDoc.photo_path ? <p className="muted">The photo link expired or is unavailable. Refresh to try again.</p> : null}
          {privateDoc.nin_ciphertext ? <ActionForm action={compareIdentityNumber} submit="Compare and record result" tone="dark">
            <input type="hidden" name="id" value={app.id} />
            <Field name="nin" label="NIN from the verified original" inputMode="numeric" pattern="[0-9]{11}" maxLength={11} autoComplete="off"
              hint="The submitted number is encrypted and never displayed." required />
          </ActionForm> : <ActionForm action={reviewIdentity} submit="Record photo review" tone="dark">
            <input type="hidden" name="id" value={app.id} />
            <Select label="Verification result" name="status"><option value="verified">Verified</option><option value="needs_review">Needs review</option></Select>
          </ActionForm>}
        </> : <p className="muted">No identity evidence was submitted.</p>}
      </section>
      <section className="panel"><h2>Fee snapshot</h2><DataList items={[
        ["Original fee",money(app.original_kobo)],["Discount",money(app.discount_kobo)],["Payable",money(app.payable_kobo)],
        ["Preferred method",METHOD_LABELS[app.payment_method]],["Transfer reference",app.transfer_reference ?? "—"],
      ]} />
      {FINANCE.includes(role) && <Link className="text-link mt-3" href={`/admin/finance?q=${encodeURIComponent(app.reference)}`}>View payment history</Link>}
      </section>
    </div>
    <section className="panel"><h2>Internal notes</h2>
      {notes.data?.length ? <div className="stack">{notes.data.map((note) => <div className="announcement" key={note.id}>
        <p className="small muted">{calendar(note.created_at)}</p><p className="whitespace-pre-line">{note.body}</p>
      </div>)}</div> : <p className="muted">No notes recorded.</p>}
    </section>
  </>;
}

async function ContentDetail({ id, query }: { id:string;query:Query }) {
  const { db } = await requireStaff(CONTENT);
  const creating = id === "new";
  if (!creating && !uuid.safeParse(id).success) notFound();
  const result = creating ? null : await db.from("site_content").select("*").eq("id",id).maybeSingle<Content>();
  if (!creating && !result?.data) notFound();
  const item = result?.data ?? undefined;
  const kind = item?.kind ?? param(query,"kind") ?? "announcement";
  if (!Object.hasOwn(CONTENT_KINDS,kind)) notFound();
  return <><Breadcrumbs items={[{ label:"Site content",href:"/admin/content" },{ label:item?.title ?? "Add content" }]} />
    <PortalTitle title={item?.title || `Add ${CONTENT_KINDS[kind as ContentKind].toLowerCase()}`}>Changes appear on the public site when published.</PortalTitle>
    <ContentEditor item={item} kind={kind as ContentKind} /></>;
}

export default async function RecordPage({ params, searchParams }: PageProps) {
  const [{ section,id },query] = await Promise.all([params,searchParams]);
  if (section==="courses") return <CourseDetail id={id} />;
  if (section==="applications") return <ApplicationDetail id={id} />;
  if (section==="content") return <ContentDetail id={id} query={query} />;
  notFound();
}
