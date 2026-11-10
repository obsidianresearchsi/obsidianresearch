import { ArrowUpRight, FileText } from "lucide-react";
import { PortalTitle } from "@/components/portal";
import { ButtonLink, Notice } from "@/components/ui";
import { requireStudent } from "@/lib/supabase";

const documents = [
  ["rules", "Student Rules & Regulations"],
  ["agreement", "Registration & Training Agreement"],
  ["guidelines", "Brand Identity & Creative Guidelines"],
];

export default async function Documents() {
  const { db,user } = await requireStudent("/dashboard/documents");
  const enrolments = await db.from("enrollments").select("course_id").eq("user_id",user.id).in("status",["active","completed"]);
  const courseIds = [...new Set(enrolments.data?.map((item) => item.course_id))];
  const materials = courseIds.length ? await db.from("course_materials").select("id,title,courses(title)").eq("published",true)
    .in("course_id",courseIds).order("created_at",{ascending:false}) : { data:[],error:null };
  const files = (materials.data ?? []) as unknown as {id:string;title:string;courses:{title:string}|null}[];
  return <><PortalTitle title="Document library">Read course materials and keep a copy of your training documents.</PortalTitle>
    <section className="panel stack"><h2>Course materials</h2>
      {materials.error || enrolments.error ? <Notice tone="error">Course materials could not be loaded.</Notice> : files.length
        ? <div className="document-list">{files.map((file) => <a key={file.id} href={`/api/course-materials/${file.id}`}>
          <span className="row"><FileText size={19} aria-hidden /><span>{file.title}<br /><small>{file.courses?.title || "Training course"}</small></span></span>
          <ArrowUpRight size={18} aria-hidden /></a>)}</div>
        : <p className="muted">Published files for your enrolled courses will appear here.</p>}
    </section>
    <section className="panel"><h2>Guidelines and rules</h2>
      <div className="document-list">{documents.map(([slug, name]) => <a key={slug} href={`/api/documents/${slug}`} target="_blank" rel="noopener">
        <span className="row"><FileText size={19} aria-hidden />{name}</span><ArrowUpRight size={18} aria-hidden />
      </a>)}</div>
      <div className="mt-4"><ButtonLink href="/policies" variant="ghost">Read online policies</ButtonLink></div>
    </section></>;
}
