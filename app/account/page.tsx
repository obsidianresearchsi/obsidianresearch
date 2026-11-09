import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requestPasswordReset, signIn, signUp } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Field, Intro, Notice } from "@/components/ui";
import { safePath } from "@/lib/forms";
import { publicConfig, session } from "@/lib/supabase";

export const metadata: Metadata = { title: "My account", robots: { index: false, follow: false } };

export default async function Account({ searchParams }: { searchParams: Promise<{ mode?: string; next?: string; expired?: string }> }) {
  const query = await searchParams;
  const next = safePath(query.next);
  if (await session()) redirect(next);
  const signup = query.mode === "register";
  const reset = query.mode === "reset";
  const title = signup ? "Create your account" : reset ? "Reset your password" : "Sign in";
  const action = signup ? signUp : reset ? requestPasswordReset : signIn;
  const href = (mode: string) => `/account?mode=${mode}&next=${encodeURIComponent(next)}`;
  return <><Intro label="Obsidian workspace" title={title}>
    Apply for training, request a service, and message our team from one account.
  </Intro><section className="section-compact"><div className="wrap auth-panel">
    <div className="panel stack">
      <h2>{signup ? "Account details" : reset ? "Request a reset link" : "Welcome back"}</h2>
      {!publicConfig().key && <Notice>Account access is being configured. Contact the training centre for help.</Notice>}
      {query.expired && <Notice tone="error">This confirmation link has expired or was opened in a different browser. Request a new link or sign in.</Notice>}
      <ActionForm action={action} submit={signup ? "Create account" : reset ? "Email reset link" : "Sign in"}>
        <input type="hidden" name="next" value={next} />
        {signup && <Field label="Full name" name="full_name" autoComplete="name" maxLength={100} required />}
        <Field label="Email address" name="email" type="email" autoComplete="email" maxLength={254} required />
        {!reset && <Field label="Password" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"}
          minLength={8} maxLength={128} hint={signup ? "Use at least eight characters." : undefined} required />}
        {signup && <p className="small muted">Your email is used to confirm your account and communicate about your application. <Link className="text-link" href="/policies#privacy">Privacy notice</Link></p>}
      </ActionForm>
      <div className="auth-links">{signup || reset ? <Link href={href("signin")}>Back to sign in</Link> : <>
        <Link href={href("register")}>Create an account</Link><Link href={href("reset")}>Forgot password?</Link></>}</div>
    </div>
  </div></section></>;
}
