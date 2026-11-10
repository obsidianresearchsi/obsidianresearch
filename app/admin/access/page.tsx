import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink, Intro } from "@/components/ui";
import { session, staffSession } from "@/lib/supabase";

export const metadata: Metadata = { title: "Staff access", robots: { index: false, follow: false } };

export default async function AdminAccess({ searchParams }: { searchParams: Promise<{ restricted?: string }> }) {
  const [current, staff, query] = await Promise.all([session(), staffSession(), searchParams]);
  if (staff && (staff.role === "super_admin" || query.restricted !== "1")) redirect("/admin");
  return <><Intro label="Management console" title="Staff access required">
    {current ? <>The account <strong>{current.user.email}</strong> doesn’t have permission for this section. Contact a super administrator if you need access.</>
      : "Sign in with your authorised staff account to continue."}
  </Intro><section className="section-compact"><div className="wrap row">
    {staff ? <ButtonLink href="/admin">Admin overview</ButtonLink> : current
      ? <ButtonLink href="/dashboard">My Workspace</ButtonLink> : <ButtonLink href="/account?next=%2Fadmin">Staff sign in</ButtonLink>}
    <ButtonLink href="/" variant="ghost">Back to website</ButtonLink>
  </div></section></>;
}
