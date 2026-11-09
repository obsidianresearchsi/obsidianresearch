import { updatePassword } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Field, Intro } from "@/components/ui";
import { requireStudent } from "@/lib/supabase";

export default async function UpdatePassword() {
  await requireStudent("/account/update");
  return <><Intro label="Account security" title="Set a new password" />
    <section className="section-compact"><div className="wrap auth-panel"><div className="panel">
      <ActionForm action={updatePassword} submit="Save password">
        <Field label="New password" name="password" type="password" minLength={8} maxLength={128} autoComplete="new-password" required />
      </ActionForm>
    </div></div></section>
  </>;
}
