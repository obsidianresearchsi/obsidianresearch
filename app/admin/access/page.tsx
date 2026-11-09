import type { Metadata } from "next";
import { ButtonLink, Intro } from "@/components/ui";
import { session } from "@/lib/supabase";

export const metadata: Metadata = { title: "Staff access", robots: { index: false, follow: false } };

export default async function AdminAccess() {
  const current = await session();
  return <><Intro label="Management console" title="Staff access required">
    {current ? "Your account doesn’t have permission for this section. Contact a super administrator if you need access."
      : "Sign in with your authorised staff account to continue."}
  </Intro><section className="section-compact"><div className="wrap row">
    <ButtonLink href={current ? "/dashboard" : "/account?next=%2Fadmin"}>{current ? "Student dashboard" : "Staff sign in"}</ButtonLink>
    <ButtonLink href="/" variant="ghost">Back to website</ButtonLink>
  </div></section></>;
}
