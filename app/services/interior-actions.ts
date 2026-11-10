"use server";

import { revalidatePath } from "next/cache";
import { uuid } from "@/lib/forms";
import { designSchema, INTERIOR_RENDER_BUCKET, INTERIOR_SERVICE, estimateInterior, interiorBrief, interiorPrices } from "@/lib/interior";
import { session } from "@/lib/supabase";

export async function submitInteriorReview(form: FormData): Promise<{ thread?: string; error?: string }> {
  const current = await session();
  if (!current?.user.email_confirmed_at) return { error: "Sign in with a confirmed email to send this design for review." };
  const { db, user } = current;
  const key = uuid.safeParse(form.get("submission"));
  const raw = form.get("design");
  if (!key.success || typeof raw !== "string" || raw.length > 1200) return { error: "This design draft is invalid." };
  let json: unknown;
  try { json = JSON.parse(raw); }
  catch { return { error: "This design draft is invalid." }; }
  const design = designSchema.safeParse(json);
  if (!design.success) return { error: "This design draft is invalid." };

  const { data: service } = await db.from("site_content").select("details").eq("kind", "service")
    .eq("slug", INTERIOR_SERVICE).eq("published", true).maybeSingle();
  if (!service) return { error: "Interior design is currently unavailable." };
  const prices = interiorPrices(service.details.interior_prices);
  if (!estimateInterior(design.data, prices).parts.length) return { error: "Choose at least one item for review." };
  const notes = form.get("notes");
  if (typeof notes !== "string" || notes.length > 700) return { error: "Keep your notes under 700 characters." };

  const file = form.get("render");
  let image: string | null = null;
  if (file instanceof File && file.size) {
    if (file.type !== "image/jpeg" || file.size > 1_500_000) return { error: "The room image must be a JPEG under 1.5 MB." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255 ||
      bytes.at(-2) !== 255 || bytes.at(-1) !== 217) return { error: "The room image could not be verified." };
    image = `${user.id}/${key.data}.jpg`;
    const { error } = await db.storage.from(INTERIOR_RENDER_BUCKET).upload(image, bytes, {
      contentType: "image/jpeg", cacheControl: "0", upsert: false,
    });
    if (error && !("statusCode" in error && Number(error.statusCode) === 409) && !/already exists/i.test(error.message)) {
      return { error: "The room image could not be uploaded. Try again." };
    }
  }
  const brief = interiorBrief(design.data, prices);
  const body = notes.trim() ? `${brief}\n\nCustomer notes: ${notes.trim()}` : brief;
  const { data, error } = await db.rpc("submit_interior_review", {
    p_submission: key.data, p_body: body, p_image: image,
  });
  if (error || typeof data !== "string") return { error: "Could not send your design. Try again." };
  revalidatePath("/dashboard/messages");
  revalidatePath(`/dashboard/messages/${data}`);
  revalidatePath("/admin/inbox");
  revalidatePath(`/admin/inbox/${data}`);
  return { thread: data };
}
