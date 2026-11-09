"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { optionalUuid, text, uuid, type FormState } from "@/lib/forms";
import { OPERATIONS, THREAD_STATUSES } from "@/lib/model";
import { requireStaff, requireStudent } from "@/lib/supabase";

const body = text("a message",4000);

export async function startConversation(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStudent("/dashboard/messages");
  const request = z.object({ service:optionalUuid, body }).safeParse(Object.fromEntries(form));
  if (!request.success) return { error: "Enter a message of up to 4,000 characters." };
  const result = await db.rpc("start_customer_thread",{ p_service:request.data.service || null,p_body:request.data.body });
  if (result.error || !result.data) return { error:result.error?.code==="P0001" ? result.error.message : "Could not start the conversation." };
  redirect(`/dashboard/messages/${result.data}`);
}

export async function sendConversationReply(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStudent("/dashboard/messages");
  const input = z.object({ id:uuid, body }).safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Enter a message of up to 4,000 characters." };
  const { error } = await db.rpc("reply_customer_thread",{ p_thread:input.data.id,p_body:input.data.body });
  if (error) return { error:error.code==="P0001" ? error.message : "Could not send your reply." };
  revalidatePath(`/dashboard/messages/${input.data.id}`);
  revalidatePath(`/admin/inbox/${input.data.id}`);
  return { success:"Message sent." };
}

export async function updateConversation(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStaff(OPERATIONS);
  const input = z.object({ id:uuid,status:z.enum(THREAD_STATUSES) }).safeParse(Object.fromEntries(form));
  if (!input.success) return { error:"Choose a valid status." };
  const { error } = await db.rpc("set_customer_thread_status",{ p_thread:input.data.id,p_status:input.data.status });
  if (error) return { error:"Could not update the status. Check whether this customer already has an active request for this service." };
  revalidatePath(`/admin/inbox/${input.data.id}`);
  revalidatePath(`/dashboard/messages/${input.data.id}`);
  return { success:"Status updated." };
}
