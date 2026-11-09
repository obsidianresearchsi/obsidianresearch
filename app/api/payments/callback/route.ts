import { NextResponse, type NextRequest } from "next/server";
import { PaymentError, verifyFlutterwave } from "@/lib/payments";
import { session } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const current = await session();
  if (!current) return NextResponse.redirect(new URL("/account", request.url));
  const q = request.nextUrl.searchParams;
  const ref = q.get("tx_ref");
  const transaction = q.get("transaction_id");
  const { data: payment } = ref ? await current.db.from("payments").select("application_id")
    .eq("reference", ref).eq("method", "flutterwave").maybeSingle() : { data: null };
  if (!payment) return NextResponse.redirect(new URL("/dashboard", request.url));
  let outcome = "pending";
  if (transaction && ref) {
    try { await verifyFlutterwave(transaction, ref); outcome = "verified"; }
    catch (error) { if (error instanceof PaymentError && error.reason === "mismatch") outcome = "review"; }
  }
  const destination = new URL(`/dashboard/applications/${payment.application_id}`, request.url);
  destination.searchParams.set("payment",outcome);
  if (outcome === "verified" && ref) destination.searchParams.set("reference",ref);
  return NextResponse.redirect(destination);
}
