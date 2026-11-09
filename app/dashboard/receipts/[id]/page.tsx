import { notFound } from "next/navigation";
import { Logo } from "@/components/shell";
import { PrintButton } from "@/components/print";
import { PortalTitle } from "@/components/portal";
import { Badge, Breadcrumbs, DataList } from "@/components/ui";
import { company, detail } from "@/lib/catalog";
import { uuid } from "@/lib/forms";
import { calendar, METHOD_LABELS, money, type Application, type Payment, type Receipt } from "@/lib/model";
import { requireStudent } from "@/lib/supabase";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { db, user }, info] = await Promise.all([params,requireStudent(),company()]);
  if (!uuid.safeParse(id).success) notFound();
  const { data: receipt } = await db.from("payment_receipts").select("*").eq("id",id).maybeSingle<Receipt>();
  if (!receipt) notFound();
  const { data: payment } = await db.from("payments").select("*").eq("id",receipt.payment_id).eq("status","confirmed").maybeSingle<Payment>();
  if (!payment) notFound();
  const { data: application } = await db.from("applications").select("full_name,reference,courses(title)")
    .eq("id",payment.application_id).eq("user_id",user.id).maybeSingle();
  if (!application) notFound();
  const a = application as unknown as Pick<Application,"full_name"|"reference"> & { courses: { title: string } | null };
  return <>
    <div className="no-print"><Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Application", href: `/dashboard/applications/${payment.application_id}` }, { label: "Receipt" }]} /></div>
    <PortalTitle title="Payment receipt" action={<PrintButton />}>Obsidian Research</PortalTitle>
    <article className="panel stack"><div className="panel-title"><Logo dark /><Badge tone="green">Confirmed payment</Badge></div>
      <DataList items={[
        ["Receipt number", <span className="reference" key="receipt">{receipt.receipt_number}</span>], ["Issued",calendar(receipt.issued_at)],
        ["Paid by",a.full_name], ["Program",a.courses?.title || "Training program"], ["Application",a.reference],
        ["Payment reference",payment.reference], ["Method",METHOD_LABELS[payment.method]], ["Amount received",money(payment.amount_kobo)],
      ]} />
      <p className="small muted">{detail(info,"address")} · {detail(info,"phone")}</p>
    </article>
  </>;
}
