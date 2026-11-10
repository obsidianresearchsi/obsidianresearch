import Link from "next/link";
import { notFound } from "next/navigation";
import { choosePayment, startCheckout } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { PortalTitle } from "@/components/portal";
import { Badge, Breadcrumbs, DataList, Field, Notice, Select } from "@/components/ui";
import { uuid } from "@/lib/forms";
import { calendar, METHOD_LABELS, METHODS, money, shortReference, STATUS_LABELS, type Application, type Payment, type Receipt } from "@/lib/model";
import { checkoutAvailable } from "@/lib/payments";
import { requireStudent } from "@/lib/supabase";

export default async function ApplicationPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ submitted?: string; payment?: string; reference?: string }>;
}) {
  const [{ id }, query, { db, user }] = await Promise.all([params,searchParams,requireStudent()]);
  if (!uuid.safeParse(id).success) notFound();
  const result = await db.from("applications").select("*,courses(title),course_batches(name)")
    .eq("id",id).eq("user_id",user.id).maybeSingle();
  const a = result.data as (Application & { courses: { title: string } | null; course_batches: { name: string } | null }) | null;
  if (!a) notFound();
  const transactions = await db.from("payments").select("*,payment_receipts(*)").eq("application_id",id).order("created_at",{ascending:false});
  const payments = (transactions.data ?? []) as (Payment & { payment_receipts: Receipt | Receipt[] | null })[];
  const verified = query.payment === "verified" && payments.some((p) =>
    p.method === "flutterwave" && p.reference === query.reference && p.status === "confirmed");
  const paid = payments.filter((p) => p.status === "confirmed").reduce((sum,p) => sum+p.amount_kobo,0);
  const due = Math.max(0,a.payable_kobo-paid);
  const underReview = a.status === "submitted" || a.status === "under_review";
  const canChoosePayment = ["approved","awaiting_payment"].includes(a.status) && due > 0;
  const canPayOnline = (canChoosePayment || underReview) && due > 0 && a.payment_method === "flutterwave";
  const canPayInstallment = canChoosePayment && a.installment_min_kobo !== null;
  const reserved = payments.find((payment) => payment.method === "flutterwave" && payment.status === "pending" &&
    Date.parse(payment.checkout_expires_at ?? "") > Date.now());
  const [instructions, online] = await Promise.all([
    canChoosePayment ? db.from("payment_settings").select("cash_instructions,transfer_instructions").maybeSingle()
      .then((result) => result.data) : null,
    canChoosePayment || canPayOnline ? checkoutAvailable() : false,
  ]);
  return <>
    <Breadcrumbs items={[{ label: "Student dashboard", href: "/dashboard" }, { label: "Application" }]} />
    <PortalTitle title={a.courses?.title || "Training application"} action={<Badge tone={a.status === "enrolled" ? "green" : "blue"}>{STATUS_LABELS[a.status]}</Badge>}>
      Application reference <span className="reference">{a.reference}</span>
    </PortalTitle>
    {query.submitted && <Notice tone="success">Application received. Keep your reference and check this page for updates.</Notice>}
    {verified && <Notice tone="success">Your payment was verified by Flutterwave.</Notice>}
    {query.payment === "checkout_retry" && canPayOnline && <Notice tone="error">Checkout could not open. You can retry from Payment options below.</Notice>}
    {query.payment === "pending" && <Notice>Payment has not been confirmed yet. Refresh this page after the provider processes it.</Notice>}
    {query.payment === "failed" && <Notice tone="error">Flutterwave could not complete this payment attempt. Check the payment section before trying again.</Notice>}
    {query.payment === "review" && <Notice tone="error">Finance needs to review this transaction. Contact the centre with your reference.</Notice>}
    {transactions.error && <Notice tone="error">Transaction history could not be loaded. Refresh before making a payment.</Notice>}
    <div className="split split-even">
      <section className="panel"><h2>Registration summary</h2><DataList items={[
        ["Submitted", calendar(a.created_at)], ["Batch", a.course_batches?.name || "To be assigned"],
        ["Preferred payment", METHOD_LABELS[a.payment_method]], ["Original fee", money(a.original_kobo)],
        ["Discount", money(a.discount_kobo)], ["Final payable", money(a.payable_kobo)], ["Confirmed paid",money(paid)],
        ["Outstanding", money(due)], ...(paid > a.payable_kobo ? [["Overpayment", money(paid-a.payable_kobo)] as [string,string]] : []),
      ]} /></section>
      <section className="panel stack"><h2>Payment options</h2>
        {canChoosePayment && <>
          <ActionForm action={choosePayment} submit="Save payment preference" tone="dark">
            <input name="id" type="hidden" value={a.id} />
            <Select label="Payment method" name="method" defaultValue={a.payment_method}>
              {METHODS.map((method) => <option key={method} value={method} disabled={method === "flutterwave" && !online && method !== a.payment_method}>
                {METHOD_LABELS[method]}{method === "flutterwave" && !online ? " (unavailable)" : ""}</option>)}
            </Select>
            <Field label="Transfer reference (if already paid)" name="reference" maxLength={120} defaultValue={a.transfer_reference || ""} />
          </ActionForm>
          {a.payment_method === "cash" && <Notice>{instructions?.cash_instructions || "Bring your application reference to the training centre."}</Notice>}
          {a.payment_method === "transfer" && <Notice>{instructions?.transfer_instructions || "Contact the training centre for verified bank details before paying."}</Notice>}
        </>}
        {canPayOnline && (!online
            ? <Notice>Flutterwave checkout is temporarily unavailable. Your application is saved. {canChoosePayment
              ? "You can choose cash or bank transfer above." : "Check here again to continue to checkout."}</Notice>
            : !transactions.error && <ActionForm action={startCheckout} submit={canPayInstallment
              ? "Continue to Flutterwave" : `Pay ${money(reserved?.amount_kobo ?? due)} with Flutterwave`}>
              <input name="id" type="hidden" value={a.id} />
              {canChoosePayment && a.installment_min_kobo && <Field label="Amount in naira (optional)" name="amount" inputMode="decimal" maxLength={11}
                hint={reserved ? `An existing checkout is reserved for ${money(reserved.amount_kobo)}.`
                  : `Leave blank for the full balance. Minimum installment ${money(a.installment_min_kobo)}.`} />}
            </ActionForm>)}
        {!canChoosePayment && !canPayOnline && !transactions.error && <p className="muted">
          {a.status === "rejected" ? (paid > 0 ? "Contact the centre with your application and payment references." : "This application was not approved.")
            : due === 0 ? (underReview && paid > 0 ? "Payment confirmed. Your application is still under review." : "There is no outstanding balance.")
              : "Cash and bank transfer instructions appear after approval."}
        </p>}
        <Link href="/policies#refund" className="text-link">Payment and refund policy</Link>
      </section>
    </div>
    <section className="panel"><h2>Transaction history</h2>
      {payments.length ? <div className="table-scroll"><table><thead><tr><th>Date</th><th>Reference</th><th>Method</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead>
        <tbody>{payments.map((p) => { const receipt = Array.isArray(p.payment_receipts) ? p.payment_receipts[0] : p.payment_receipts;
          return <tr key={p.id}><td>{calendar(p.confirmed_at ?? p.created_at)}</td><td className="reference">{shortReference(p.reference)}</td>
            <td>{METHOD_LABELS[p.method]}</td><td>{money(p.amount_kobo)}</td>
            <td><Badge tone={p.status === "confirmed" ? "green" : "neutral"}>{p.status}</Badge></td>
            <td>{receipt ? <Link href={`/dashboard/receipts/${receipt.id}`}>View receipt</Link> : "—"}</td></tr>;
        })}</tbody></table></div> : <p className="muted">No transactions yet.</p>}
    </section>
  </>;
}
