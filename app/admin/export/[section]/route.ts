import { applicationQuery, filters, financeAccounts, paymentQuery } from "@/lib/admin-data";
import { FINANCE, OPERATIONS, type Payment } from "@/lib/model";
import { staffSession } from "@/lib/supabase";

function escapeCsv(value: unknown) {
  const raw = String(value ?? "");
  const safe = /^[\t\r\n]|^[\s\uFEFF]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"','""')}"`;
}

function csv(name: string, columns: string[], rows: unknown[][]) {
  const body = [columns,...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  return new Response(`\uFEFF${body}\r\n`,{ headers:{
    "Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${name}.csv"`,
    "Cache-Control":"private, no-store",
  } });
}

export async function GET(request: Request, { params }: { params:Promise<{ section:string }> }) {
  const { section } = await params;
  const current = await staffSession();
  if (!current) return new Response(null,{status:401});
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const { db,role } = current;
  const rows: unknown[][] = [];
  if (section === "applications") {
    if (!OPERATIONS.includes(role)) return new Response(null,{status:403});
    for (let start=0;;start+=500) {
      const { data,error } = await applicationQuery(db,query,"reference,full_name,email,phone,status,created_at,courses(title)").range(start,start+499);
      if (error) return new Response("Export could not be generated.",{status:503});
      const page = (data ?? []) as unknown as { reference:string;full_name:string;email:string;phone:string;status:string;created_at:string;courses:{title:string}|null }[];
      rows.push(...page.map((a) => [a.reference,a.full_name,a.email,a.phone,a.courses?.title,a.status,a.created_at]));
      if (page.length < 500) break;
    }
    return csv("obsidian-applications",["Application reference","Applicant","Email","Phone","Program","Status","Submitted at"],rows);
  }
  if (section === "finance") {
    if (!FINANCE.includes(role)) return new Response(null,{status:403});
    const accounts = await financeAccounts(db);
    if (accounts.error) return new Response("Export could not be generated.",{status:503});
    const map = new Map(accounts.items.map((a) => [a.id,a]));
    const f = filters(query);
    const ids = f.course || f.search ? accounts.items.filter((a) => (!f.course || a.course_id===f.course) &&
      (!f.search || `${a.full_name} ${a.reference}`.toLowerCase().includes(f.search.toLowerCase()))).map((a) => a.id) : undefined;
    if (ids?.length !== 0) for (let start=0;;start+=500) {
      const { data,error } = await paymentQuery(db,query,ids).range(start,start+499);
      if (error) return new Response("Export could not be generated.",{status:503});
      const page = (data ?? []) as (Payment & { payment_receipts:{receipt_number:string} | {receipt_number:string}[] | null })[];
      rows.push(...page.map((p) => { const a=map.get(p.application_id); const r=Array.isArray(p.payment_receipts)?p.payment_receipts[0]:p.payment_receipts;
        return [p.reference,a?.reference,a?.full_name,a?.course_title,p.method,p.status,(p.amount_kobo/100).toFixed(2),p.currency,
          p.external_reference,p.provider_transaction_id,r?.receipt_number,p.created_at,p.confirmed_at]; }));
      if (page.length<500) break;
    }
    return csv("obsidian-payments",["Payment reference","Application","Student","Program","Method","Status","Amount","Currency",
      "Offline reference","Flutterwave transaction","Receipt","Created","Confirmed"],rows);
  }
  return new Response(null,{status:404});
}
