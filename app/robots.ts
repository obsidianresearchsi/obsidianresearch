import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://www.obsidianresearch.si";
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/dashboard", "/account", "/apply", "/auth", "/api"] },
    sitemap: new URL("/sitemap.xml", site).href };
}
