import { z } from "zod";

export const EQUIPMENT_KINDS = { ap:"Outdoor access point", router:"Router", switch:"PoE switch", inverter:"Solar inverter" } as const;
export const equipmentSchema = z.object({
  id:z.uuid(), kind:z.enum(["ap","router","switch","inverter"]),
  brand:z.string().min(1).max(45), model:z.string().min(1).max(65),
  price_kobo:z.number().int().min(0).max(5_000_000_000).nullable(),
  radius_m:z.number().int().min(20).max(600).nullable(),
  watts:z.number().int().min(500).max(50000).nullable(),
  surge_watts:z.number().int().min(500).max(100000).nullable(),
  voltage:z.union([z.literal(24),z.literal(48)]).nullable(),
  photo_path:z.string().regex(/^[a-f0-9-]{36}\.(jpg|png|webp)$/).nullable(),
  active:z.boolean(),
});
export type StudioEquipment = z.infer<typeof equipmentSchema>;
export const equipmentName = (item: StudioEquipment) => `${item.brand} ${item.model}`;
export const equipmentImage = (item: StudioEquipment) => item.photo_path && process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/editorial-media/${item.photo_path}` : "";

export function readEquipment(data: unknown): StudioEquipment[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => { const parsed = equipmentSchema.safeParse(item); return parsed.success ? [parsed.data] : []; });
}
