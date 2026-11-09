import Link from "next/link";
import { notFound } from "next/navigation";
import { updateConversation } from "@/app/dashboard/conversation-actions";
import { uuid } from "@/lib/forms";
import { OPERATIONS, THREAD_LABELS, THREAD_STATUSES, type CustomerMessage, type CustomerThread } from "@/lib/model";
import { requireStaff, requireStudent } from "@/lib/supabase";
import { ActionForm } from "./action-form";
import { Conversation } from "./conversations";
import { PortalTitle } from "./portal";
import { Notice, Select } from "./ui";

export async function ConversationPage({ id,before,staff }: { id:string;before?: string;staff?:boolean }) {
  if (!uuid.safeParse(id).success) notFound();
  const base = staff ? "/admin/inbox" : "/dashboard/messages";
  const { db,user } = staff ? await requireStaff(OPERATIONS) : await requireStudent(`${base}/${id}`);
  let lookup = db.from("customer_threads").select("*").eq("id",id);
  if (!staff) lookup = lookup.eq("user_id",user.id);
  const result = await lookup.maybeSingle<CustomerThread>();
  if (result.error) return <Notice tone="error">Could not load the conversation. Refresh to try again.</Notice>;
  if (!result.data) notFound();
  const thread = result.data;
  let query = db.from("customer_messages").select("*").eq("thread_id",id).order("id",{ascending:false}).limit(51);
  const older = typeof before === "string" && /^\d{1,15}$/.test(before);
  if (older) query = query.lt("id",before);
  const [messages,profile] = await Promise.all([
    query, staff ? db.from("profiles").select("full_name").eq("id",thread.user_id).maybeSingle() : null,
  ]);
  const rows = (messages.data ?? []) as CustomerMessage[];
  const page = rows.slice(0,50).reverse();
  return <>
    <Link className="text-link" href={base}>Back to {staff ? "staff inbox" : "messages"}</Link>
    <PortalTitle title={thread.subject}>{staff && profile?.data?.full_name ? `${profile.data.full_name} · ` : ""}
      {thread.service_id ? "Service request" : "Support chat"}</PortalTitle>
    {older && <Link className="text-link" href={`${base}/${id}`}>Back to latest messages</Link>}
    {messages.error ? <Notice tone="error">Could not load the messages. Refresh to try again.</Notice> :
      <Conversation thread={thread} messages={page} staff={staff} earlier={rows.length>50}
        olderHref={page[0] ? `${base}/${id}?before=${page[0].id}` : undefined} historical={older} />}
    {staff && <section className="panel"><h2>Update request status</h2>
      <ActionForm action={updateConversation} submit="Save status">
        <input type="hidden" name="id" value={id} />
        <Select name="status" label="Status" defaultValue={thread.status}>
          {THREAD_STATUSES.map((status) => <option key={status} value={status}>{THREAD_LABELS[status]}</option>)}
        </Select>
      </ActionForm>
    </section>}
  </>;
}
