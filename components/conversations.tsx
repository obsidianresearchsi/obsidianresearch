import Link from "next/link";
import { ArrowUpRight, MessageSquare } from "lucide-react";
import { sendConversationReply } from "@/app/dashboard/conversation-actions";
import { calendar, money, THREAD_LABELS, type CustomerMessage, type CustomerThread } from "@/lib/model";
import { ActionForm } from "./action-form";
import { ChatRefresh } from "./chat-refresh";
import { Badge, Notice, Textarea } from "./ui";

export function ThreadList({ items, base, names }: { items: CustomerThread[]; base: string; names?: Record<string,string> }) {
  return <div className="thread-list">{items.map((item) => <Link className="thread-row" href={`${base}/${item.id}`} key={item.id}>
    <span className="thread-icon"><MessageSquare size={18} aria-hidden /></span>
    <span className="thread-label"><strong>{item.subject}</strong><small>
      {names?.[item.user_id] ? `${names[item.user_id]} · ` : ""}{item.service_id ? "Service request" : "Support chat"} · {calendar(item.updated_at)}
    </small></span>
    <Badge tone={item.status === "approved" || item.status === "completed" ? "green" : "blue"}>{THREAD_LABELS[item.status]}</Badge>
    <ArrowUpRight size={17} aria-hidden />
  </Link>)}</div>;
}

export function Conversation({ thread, messages, staff = false, earlier, olderHref, historical }: {
  thread: CustomerThread; messages: CustomerMessage[]; staff?: boolean; earlier?: boolean; olderHref?: string; historical?: boolean;
}) {
  const active = !["closed","completed"].includes(thread.status);
  return <section className="panel stack">
    <div className="panel-title"><h2>Conversation</h2><Badge tone="blue">{THREAD_LABELS[thread.status]}</Badge></div>
    {thread.service_id && <p className="small muted">Price when requested: {thread.price_kobo === null ? "Quote on request" : money(thread.price_kobo)}</p>}
    {earlier && olderHref && <Link className="text-link" href={olderHref}>Load earlier messages</Link>}
    <ol className="chat-feed">{messages.map((item) => {
      const own = staff === item.from_staff;
      return <li key={item.id} className={own ? "chat-message chat-message-own" : "chat-message"}>
        <small>{item.from_staff ? (staff ? "Staff" : "Obsidian Research") : (staff ? "Customer" : "You")} · {new Intl.DateTimeFormat("en-NG", {
          dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Lagos",
        }).format(new Date(item.created_at))}</small>
        <p>{item.body}</p>
      </li>;
    })}</ol>
    {!historical && (active ? <ActionForm action={sendConversationReply} submit="Send message" tone="dark" clearAfterSend>
      <input type="hidden" name="id" value={thread.id} />
      <Textarea name="body" label="Your message" placeholder="Write a reply…" rows={3} maxLength={4000} required />
    </ActionForm> : <Notice>This conversation is closed.</Notice>)}
    {!historical && <ChatRefresh />}
  </section>;
}
