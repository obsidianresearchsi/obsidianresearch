"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uploadEditorialImage } from "./editorial-actions";
import { optionalUuid, text, toKobo, type FormState } from "@/lib/forms";
import { CONTENT } from "@/lib/model";
import { requireStaff } from "@/lib/supabase";

export async function saveStudioEquipment(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStaff(CONTENT);
  const input = z.object({
    id:optionalUuid, kind:z.enum(["ap","router","switch","inverter"]),
    brand:text("a brand",45), model:text("a model",65),
  }).safeParse(Object.fromEntries(form));
  if (!input.success) return { error:"Enter a valid brand, model and category." };
  const { id, kind, brand, model } = input.data;
  const price = String(form.get("price") ?? "").trim();
  const priceKobo = price ? toKobo(price) : null;
  if (price && (priceKobo === null || priceKobo > 5_000_000_000)) return { error:"Enter a valid unit price in naira." };
  const rating = (name: string, min: number, max: number) => {
    const parsed = z.coerce.number().int().min(min).max(max).safeParse(form.get(name));
    return parsed.success ? parsed.data : null;
  };
  const radius = kind === "ap" ? rating("radius",20,600) : null;
  const watts = kind === "inverter" ? rating("watts",500,50000) : null;
  const surge = kind === "inverter" && watts !== null ? rating("surge",watts,100000) : null;
  const voltage = kind === "inverter" ? rating("voltage",24,48) : null;
  if (kind === "ap" && radius === null) return { error:"Enter an outdoor planning radius from 20 to 600 metres." };
  if (kind === "inverter" && (watts === null || surge === null || (voltage !== 24 && voltage !== 48))) {
    return { error:"Enter continuous and surge wattage and a 24 V or 48 V battery voltage." };
  }
  const file = form.get("image");
  let photo: string | undefined;
  if (file instanceof File && file.size) {
    const uploaded = await uploadEditorialImage(form);
    if (!uploaded.url) return { error:uploaded.error ?? "Could not upload the product photo." };
    photo = new URL(uploaded.url).pathname.split("/").at(-1);
  }
  const data = { kind,brand,model,price_kobo:priceKobo,radius_m:radius,watts,surge_watts:surge,voltage,
    active:form.get("active")==="on", ...(photo ? { photo_path:photo } : {}) };
  const result = id ? await db.from("studio_equipment").update(data).eq("id",id).eq("kind",kind).select("id").single()
    : await db.from("studio_equipment").insert(data);
  if (result.error) {
    if (photo) await db.storage.from("editorial-media").remove([photo]);
    return { error:result.error.code==="23505" ? "That brand and model are already in the catalogue." : "Could not save the equipment." };
  }
  revalidatePath("/admin/equipment");
  revalidatePath("/services/advanced-networking");
  revalidatePath("/services/solar-power");
  return { success:"Equipment saved." };
}
