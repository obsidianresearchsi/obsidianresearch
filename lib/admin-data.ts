import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STATUSES, type ApplicationStatus, type FinanceAccount } from "./model";
import { uuid } from "./forms";

export type Query = Record<string, string | string[] | undefined>;
export const param = (query: Query, key: string) => typeof query[key] === "string" ? query[key] : undefined;

export function filters(query: Query) {
  const course = param(query,"course");
  const status = param(query,"status");
  const search = param(query,"q")?.trim().slice(0,100);
  const from = param(query,"from");
  const to = param(query,"to");
  return {
    course: course && uuid.safeParse(course).success ? course : "",
    status: status && (STATUSES as readonly string[]).includes(status) ? status as ApplicationStatus : "",
    search: search ?? "",
    from: from && /^\d{4}-\d{2}-\d{2}$/.test(from) && Number.isFinite(Date.parse(from)) ? from : "",
    to: to && /^\d{4}-\d{2}-\d{2}$/.test(to) && Number.isFinite(Date.parse(to)) ? to : "",
  };
}

export function applicationQuery(db: SupabaseClient, query: Query, select: string) {
  const f = filters(query);
  let q = db.from("applications").select(select, { count:"exact" });
  if (f.search) q = q.ilike("full_name",`%${f.search.replace(/[\\%_]/g,"\\$&")}%`);
  if (f.course) q = q.eq("course_id",f.course);
  if (f.status) q = q.eq("status",f.status);
  return q.order("created_at",{ascending:false}).order("id");
}

export async function financeAccounts(db: SupabaseClient) {
  const items: FinanceAccount[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await db.rpc("finance_accounts").order("created_at",{ascending:false}).order("id").range(start,start+499);
    if (error) return { items, error };
    const page = (data ?? []) as FinanceAccount[];
    items.push(...page);
    if (page.length < 500) return { items, error:null };
  }
}

export function paymentQuery(db: SupabaseClient, query: Query, accountIds?: string[]) {
  const { from,to } = filters(query);
  let q = db.from("payments").select("*,payment_receipts(receipt_number)",{count:"exact"});
  if (accountIds) q = q.in("application_id", accountIds);
  const status = param(query,"payment_status");
  if (status && ["pending","confirmed","cancelled"].includes(status)) q = q.eq("status",status);
  if (from) q = q.gte("created_at",`${from}T00:00:00+01:00`);
  if (to) {
    const end = new Date(`${to}T00:00:00+01:00`);
    end.setUTCDate(end.getUTCDate()+1);
    q = q.lt("created_at",end.toISOString());
  }
  return q.order("created_at",{ascending:false}).order("id");
}
