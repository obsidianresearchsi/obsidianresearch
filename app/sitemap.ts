import type { MetadataRoute } from "next";
import { catalog } from "@/lib/catalog";
import { publicDb } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://www.obsidianresearch.si";
  const [{ content, courses }, articles] = await Promise.all([
    catalog(),publicDb()?.from("site_content").select("slug,updated_at").eq("kind","article").eq("published",true),
  ]);
  return [
    "/", "/about", "/services", "/training", "/news", "/contact", "/policies",
    ...content.filter((row) => row.kind === "service").map((row) => `/services/${row.slug}`),
    ...courses.map((row) => `/training/${row.slug}`),
  ].map((path): MetadataRoute.Sitemap[number] => ({ url: new URL(path,site).href })).concat(
    (articles?.data ?? []).map(({slug,updated_at}) => ({url:new URL(`/news/${slug}`,site).href,lastModified:updated_at})),
  );
}
