import { CourseMaterialUpload } from "@/components/course-material-upload";
import { ActionForm } from "@/components/action-form";
import { PortalTitle } from "@/components/portal";
import { Badge, Notice } from "@/components/ui";
import { changeCourseMaterial } from "@/app/admin/material-actions";
import { calendar, OPERATIONS } from "@/lib/model";
import { requireStaff } from "@/lib/supabase";

export default async function MaterialsAdmin() {
  const { db } = await requireStaff(OPERATIONS);
  const [courses, materials] = await Promise.all([
    db.from("courses").select("id,title").order("title"),
    db.from("course_materials").select("id,course_id,title,download_name,published,created_at").order("created_at",{ascending:false}),
  ]);
  const titles = new Map(courses.data?.map((course) => [course.id,course.title]));
  return <><PortalTitle title="Course materials">Publish files to the students enrolled in a specific course.</PortalTitle>
    {(courses.error || materials.error) && <Notice tone="error">Course materials could not be fully loaded.</Notice>}
    <div className="split split-even">
      <section className="panel stack"><h2>New course material</h2><CourseMaterialUpload courses={courses.data ?? []} /></section>
      <section className="panel stack"><h2>Material library</h2>
        {materials.data?.length ? materials.data.map((item) => <article className="network-link-item" key={item.id}>
          <div className="panel-title"><strong>{item.title}</strong><Badge tone={item.published ? "green" : "neutral"}>{item.published ? "Published" : "Draft or hidden"}</Badge></div>
          <p className="small muted">{titles.get(item.course_id)} · {calendar(item.created_at)}</p>
          <a className="text-link" href={`/api/course-materials/${item.id}`}>{item.download_name}</a>
          <ActionForm action={changeCourseMaterial} submit={item.published ? "Hide from students" : "Publish to course"} tone="ghost">
            <input name="id" type="hidden" value={item.id} />
            <input name="published" type="hidden" value={String(!item.published)} />
          </ActionForm>
        </article>) : <p className="muted">Uploaded materials will appear here.</p>}
      </section>
    </div>
  </>;
}
