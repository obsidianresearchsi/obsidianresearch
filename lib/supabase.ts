import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ROLES, type Role } from "./model";

export const publicConfig = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

export function publicDb() {
  const { url, key } = publicConfig();
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

export async function serverDb() {
  const { url, key } = publicConfig();
  if (!url || !key) return null;
  const jar = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        try { for (const { name, value, options } of values) jar.set(name, value, options); }
        catch { /* Proxy refreshes cookies for Server Components. */ }
      },
    },
  });
}

export function privilegedDb() {
  const { url } = publicConfig();
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

export const session = cache(async () => {
  const db = await serverDb();
  if (!db) return null;
  const { data } = await db.auth.getUser();
  return data.user ? { db, user: data.user } : null;
});

export async function requireStudent(next = "/dashboard") {
  const current = await session();
  if (!current) redirect(`/account?next=${encodeURIComponent(next)}`);
  return current;
}

export const staffSession = cache(async () => {
  const current = await session();
  if (!current?.user.email_confirmed_at) return null;
  // Resolve the role only for the verified account. Staff actions keep its RLS-scoped client.
  const directory = privilegedDb() ?? current.db;
  const { data, error } = await directory.from("user_roles").select("role").eq("user_id", current.user.id).maybeSingle();
  if (error) console.error("Staff role lookup failed", { code: error.code });
  if (!data || !ROLES.includes(data.role)) return null;
  return { ...current, role: data.role as Role };
});

export async function requireStaff(allowed?: Role[]) {
  const current = await staffSession();
  if (!current) redirect("/admin/access");
  if (allowed && !allowed.includes(current.role)) redirect("/admin/access?restricted=1");
  return current;
}
