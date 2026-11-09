import Link from "next/link";
import { startConversation } from "@/app/dashboard/conversation-actions";
import { ActionForm } from "@/components/action-form";
import { ThreadList } from "@/components/conversations";
import { PortalTitle } from "@/components/portal";
import { Empty, Notice, Textarea } from "@/components/ui";
import type { CustomerThread } from "@/lib/model";
import { requireStudent } from "@/lib/supabase";

export default async function Messages() {
  const { db,user } = await requireStudent("/dashboard/messages");
  const { data,error } = await db.from("customer_threads").select("*").eq("user_id",user.id).order("updated_at",{ascending:false});
  const items = (data ?? []) as CustomerThread[];
  const support = items.find((item) => item.service_id === null && !["closed","completed"].includes(item.status));
  return <>
    <PortalTitle title="Messages">Talk to the Obsidian Research team and follow replies about your services.</PortalTitle>
    {error && <Notice tone="error">Could not load your conversations. Refresh to try again.</Notice>}
    <section className="panel stack"><h2>Your inbox</h2>
      {items.length ? <ThreadList items={items} base="/dashboard/messages" /> :
        <Empty title="You have no messages">Start a chat below or send a <Link className="text-link" href="/dashboard/services">service request</Link>.</Empty>}
    </section>
    {!support && !error && <section className="panel stack"><h2>Start a support chat</h2>
      <ActionForm action={startConversation} submit="Start chat">
        <input type="hidden" name="service" value="" />
        <Textarea name="body" label="How can we help?" rows={3} maxLength={4000} required />
      </ActionForm>
    </section>}
  </>;
}
