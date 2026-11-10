import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { publicDb } from "./supabase";
import type { Batch, Content, Course, Module, Offer } from "./model";

export const TAGLINE = "Innovating Technology. Connecting People. Delivering Smart Solutions.";
export const WHATSAPP = "https://wa.me/2349063412927";
export const DEFAULT_COMPANY = {
  title: "Obsidian Research",
  summary: "We build digital infrastructure, develop technology solutions, and teach practical skills at our training centre in Katsina.",
  body: "Our work brings together technical implementation, consulting and professional education.",
  details: {
    tagline: TAGLINE, phone: "+234 906 341 2927", website: "https://www.obsidianresearch.si",
    address: "Office No. 14, Mangal Plaza, Opposite Water Board, Katsina State, Nigeria.",
    email: "obsidianresearch.si@gmail.com",
  } as Record<string, unknown>,
};

export const SERVICE_VISUALS: Record<string, { image: string; accent: string }> = {
  "ai-machine-learning": { image: "/media/infrastructure.webp", accent: "blue" },
  "advanced-networking": { image: "/media/networking.webp", accent: "blue" },
  "web-mobile-design": { image: "/media/infrastructure.webp", accent: "blue" },
  "hajj-umrah": { image: "", accent: "gold" },
  "forex-crypto-meetups": { image: "/media/forex.webp", accent: "gold" },
  starlink: { image: "/media/infrastructure.webp", accent: "blue" },
  "interior-design": { image: "", accent: "gold" },
  consultation: { image: "", accent: "blue" },
};

export function detail(content: { details: Record<string, unknown> }, key: string, fallback = "") {
  const value = content.details[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function detailsList(content: Content, key: string) {
  const value = content.details[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export const catalog = cache(async () => {
  await connection();
  const db = publicDb();
  if (!db) return { available: false, content: [] as Content[], courses: [] as Course[], offers: [] as Offer[] };
  const [content, courses, offers] = await Promise.all([
    db.from("site_content").select("*").eq("published", true).neq("kind","article").neq("kind","portfolio").order("position").order("title"),
    db.from("courses").select("*").eq("published", true).eq("archived", false).order("created_at"),
    db.rpc("public_offers"),
  ]);
  return {
    available: !content.error && !courses.error && !offers.error,
    content: (content.data ?? []) as Content[], courses: (courses.data ?? []) as Course[], offers: (offers.data ?? []) as Offer[],
  };
});

export async function courseBySlug(slug: string) {
  const { courses, offers } = await catalog();
  const course = courses.find((item) => item.slug === slug);
  const db = publicDb();
  if (!course || !db) return null;
  const [modules, batches] = await Promise.all([
    db.from("course_modules").select("*").eq("course_id", course.id).order("position"),
    db.from("course_batches").select("*").eq("course_id", course.id).eq("accepting", true).order("starts_at"),
  ]);
  return {
    course, modules: (modules.data ?? []) as Module[], batches: (batches.data ?? []) as Batch[],
    offer: offers.find((item) => item.course_id === course.id),
  };
}

export async function company() {
  const { content } = await catalog();
  return content.find((item) => item.kind === "company" && item.slug === "profile") ?? DEFAULT_COMPANY;
}

export function courseCover(course: Course) {
  return course.cover_url || (course.accent === "gold" ? "/media/forex.webp" : "/media/networking.webp");
}

export function siteOrigin() {
  const url = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return new URL(url).origin;
}
