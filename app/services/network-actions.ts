"use server";

import { revalidatePath } from "next/cache";
import { uuid } from "@/lib/forms";
import { equipmentDeviceKind, NETWORK_SERVICE, networkBrief, networkPlanSchema, networkPrices } from "@/lib/network";
import { readEquipment } from "@/lib/studio-equipment";
import { privilegedDb, session } from "@/lib/supabase";

export async function submitNetworkReview(form: FormData): Promise<{ thread?: string; error?: string }> {
  const current = await session();
  if (!current?.user.email_confirmed_at) return { error: "Sign in with a confirmed email to send a network design." };
  const key = uuid.safeParse(form.get("id"));
  const input = form.get("plan");
  const notes = form.get("notes");
  if (!key.success || typeof input !== "string" || input.length > 10_000 || typeof notes !== "string" || notes.length > 600) {
    return { error: "Check the network design and keep notes under 600 characters." };
  }
  let raw: unknown;
  try { raw = JSON.parse(input); }
  catch { return { error: "The network design could not be read." }; }
  const plan = networkPlanSchema.safeParse(raw);
  if (!plan.success || !plan.data.devices.length) return { error: "Add equipment and check your network connections." };
  const { data: service } = await current.db.from("site_content").select("details").eq("kind","service")
    .eq("slug",NETWORK_SERVICE).eq("published",true).maybeSingle();
  const db = privilegedDb();
  if (!service || !db) return { error: "Online design review is temporarily unavailable." };
  const prices = networkPrices(service.details.network_prices);
  const ids = [...new Set(plan.data.devices.flatMap(({ modelId }) => modelId ? [modelId] : []))];
  const equipmentResult = ids.length ? await current.db.from("studio_equipment").select("*").eq("active",true).in("id",ids) : null;
  const equipment = readEquipment(equipmentResult?.data);
  if (ids.length !== equipment.length || plan.data.devices.some(({ kind,modelId }) => {
    if (!modelId) return false;
    const item = equipment.find(({ id }) => id===modelId);
    return !item || item.kind==="inverter" || equipmentDeviceKind[item.kind]!==kind;
  })) return { error:"One or more custom models are unavailable. Replace them before sending this design." };
  const body = networkBrief(plan.data, prices, equipment) + (notes.trim() ? `\n\nCustomer notes: ${notes.trim()}` : "");
  const { data, error } = await db.rpc("submit_network_review", {
    p_user: current.user.id, p_submission: key.data, p_body: body, p_plan: { plan: plan.data, prices, equipment },
  });
  if (error || typeof data !== "string") return { error: "Could not send this design. Try again." };
  revalidatePath("/dashboard/messages");
  revalidatePath(`/dashboard/messages/${data}`);
  revalidatePath("/admin/inbox");
  revalidatePath(`/admin/inbox/${data}`);
  return { thread: data };
}
