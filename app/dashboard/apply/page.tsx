import { PortalTitle } from "@/components/portal";
import { Badge, ButtonLink, Empty, Notice } from "@/components/ui";
import { catalog } from "@/lib/catalog";
import { courseState, money } from "@/lib/model";
import { requireStudent } from "@/lib/supabase";

export default async function WorkspaceApply() {
  const { db, user } = await requireStudent("/dashboard/apply");
  const [{ courses, available }, applications] = await Promise.all([
    catalog(), db.from("applications").select("id,course_id").eq("user_id", user.id).neq("status", "rejected"),
  ]);
  const byCourse = new Map(applications.data?.map((item) => [item.course_id, item.id]));
  return <><PortalTitle title="Apply for training">Choose a program and complete your application in My Workspace.</PortalTitle>
    {(!available || applications.error) && <Notice tone="error">Some application information could not be loaded. Refresh to try again.</Notice>}
    {courses.length ? <div className="workspace-shortcuts">
      {courses.map((course) => {
        const existing = byCourse.get(course.id);
        const state = courseState(course);
        return <article className="panel stack" key={course.id}>
          <Badge tone={state.open ? "green" : "neutral"}>{state.open ? "Applications open" : "Registration closed"}</Badge>
          <h2>{course.title}</h2><p className="muted">{course.summary}</p><strong>{money(course.fee_kobo)}</strong>
          {existing ? <ButtonLink href={`/dashboard/applications/${existing}`} variant="dark">View my application</ButtonLink>
            : state.open && <ButtonLink href={`/dashboard/apply/${course.slug}`}>Start application</ButtonLink>}
        </article>;
      })}
    </div> : <Empty title="No published courses yet" />}
  </>;
}
