import { CreditCard } from "lucide-react";
import { headers } from "next/headers";
import { saveFlutterwaveSettings } from "@/app/admin/payment-settings-actions";
import { ActionForm } from "@/components/action-form";
import { PortalTitle } from "@/components/portal";
import { Badge, Check, Field, Notice } from "@/components/ui";
import { canEncryptPayments, flutterwaveConfiguration, storedFlutterwave } from "@/lib/flutterwave-settings";
import { paymentSiteOrigin } from "@/lib/payments";
import { requireStaff } from "@/lib/supabase";

export default async function Settings() {
  await requireStaff(["super_admin"]);
  const [saved, configuration, requestHeaders] = await Promise.all([storedFlutterwave(),flutterwaveConfiguration(),headers()]);
  const configured = Boolean(configuration?.secret && configuration.webhook);
  const encryption = canEncryptPayments();
  return <>
    <PortalTitle title="Payment settings">Control Flutterwave checkout and manage its credentials.</PortalTitle>
    <section className="panel stack">
      <div className="panel-title"><h2><CreditCard size={22} className="inline mr-2" aria-hidden />Flutterwave</h2>
        <Badge tone={saved?.enabled && configured ? "green" : "neutral"}>
          {!configured ? "Setup required" : saved?.enabled ? "Checkout enabled" : "Checkout paused"}
        </Badge></div>
      <p>Use this URL when configuring webhooks in your Flutterwave merchant account.</p>
      <code className="settings-endpoint">{paymentSiteOrigin(requestHeaders.get("host"))}/api/payments/webhook</code>
      {!saved ? <Notice>Connect the server to Supabase with its server key to manage payment settings here.</Notice> :
        <ActionForm action={saveFlutterwaveSettings} submit="Save settings" clearAfterSend>
          {!encryption && <Notice>Set the server payment encryption key to save credentials here.</Notice>}
          <Field label="Flutterwave secret key" name="secret" type="password" autoComplete="new-password" maxLength={256}
            hint={configuration?.secret ? "Configured. Leave blank to keep the existing key." : "Enter your merchant secret key."} />
          <Field label="Webhook secret hash" name="webhook" type="password" autoComplete="new-password" maxLength={256}
            hint={configuration?.webhook ? "Configured. Leave blank to keep the existing hash." : "Use the hash set in the merchant account."} />
          <Check name="enabled" defaultChecked={saved.enabled}>Allow new online checkouts</Check>
        </ActionForm>}
      <p className="small muted">Pausing checkout still lets existing payments be verified.</p>
    </section>
  </>;
}
