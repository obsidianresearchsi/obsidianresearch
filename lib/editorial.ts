import type { Content } from "./model";

export function editorialImage(value: unknown) {
  if (typeof value !== "string") return "";
  if (/^\/media\/[a-z0-9.-]+\.(webp|png|jpe?g)$/i.test(value)) return value;
  try {
    const url = new URL(value);
    const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://invalid.example").origin;
    return url.protocol === "https:" && url.origin === origin &&
      /^\/storage\/v1\/object\/public\/editorial-media\/[a-f0-9-]+\.(webp|png|jpg)$/.test(url.pathname)
      ? url.href : "";
  } catch { return ""; }
}

export function articleDate(item: Content) {
  const saved = item.details.published_at;
  return typeof saved === "string" && Number.isFinite(Date.parse(saved)) ? saved : item.updated_at;
}

export function readingMinutes(body: string) {
  return Math.max(1, Math.ceil(body.trim().split(/\s+/).length / 220));
}
