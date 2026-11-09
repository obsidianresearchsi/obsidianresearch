import { readFile, readdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

async function readCredential() {
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdout.write("Ready for Supabase management credential on stdin (input is hidden).\n");
  let input = "";
  try {
    for await (const chunk of process.stdin) {
      input += chunk.toString("utf8");
      if (/[\r\n]/.test(input)) break;
    }
  } finally {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
  }
  const token = input.trim();
  if (!/^sbp_[a-z0-9]+$/i.test(token)) throw new Error("A Supabase personal access token is required.");
  return token;
}

const [command, ref, email] = process.argv.slice(2);
if (!["list", "inspect", "apply", "connect", "bootstrap-admin", "upload-documents"].includes(command) ||
  (command !== "list" && !/^[a-z0-9]{20}$/.test(ref ?? "")) ||
  (command === "bootstrap-admin" && !/^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email ?? ""))) {
  throw new Error("Usage: node scripts/manage-db.mjs list | inspect <project-ref> | apply <project-ref> | connect <project-ref> | upload-documents <project-ref> | bootstrap-admin <project-ref> <confirmed-email>");
}
const token = await readCredential();

async function request(path, body) {
  const response = await fetch(`https://api.supabase.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    const message = await response.json().catch(() => ({}));
    throw new Error(`Supabase API HTTP ${response.status}: ${String(message.message ?? "Request failed").replaceAll(token, "[redacted]").slice(0, 350)}`);
  }
  return response.json().catch(() => null);
}

if (command === "list") {
  const projects = await request("/projects");
  console.log(projects.map(({ id, ref, name, status }) => ({ ref: ref ?? id, name, status })));
} else if (command === "connect") {
  const keys = await request(`/projects/${ref}/api-keys?reveal=false`);
  const publishable = keys.find((key) => key.type === "publishable" && key.api_key?.startsWith("sb_publishable_"))?.api_key
    ?? keys.find((key) => key.name === "anon" && key.api_key?.split(".").length === 3)?.api_key;
  if (!publishable) throw new Error("No publishable key was returned. Use the project's Connect dialog.");
  await writeFile(new URL("../.env.local", import.meta.url),
    `NEXT_PUBLIC_SITE_URL=http://localhost:3000\nNEXT_PUBLIC_SUPABASE_URL=https://${ref}.supabase.co\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishable}\n`,
    { flag: "wx" });
  console.log("Wrote .env.local with the public project URL and publishable key.");
} else if (command === "upload-documents") {
  const names = ["student-rules-and-regulations.pdf", "student-registration-form-print.pdf", "brand-identity-and-creative-guidelines.pdf"];
  const documents = await Promise.all(names.map(async (name) => {
    const bytes = await readFile(new URL(`../documents/${name}`, import.meta.url));
    if (bytes.subarray(0, 5).toString() !== "%PDF-" || bytes.length > 10_485_760) throw new Error(`Invalid or oversized PDF: ${name}`);
    return { name, bytes };
  }));
  const keys = await request(`/projects/${ref}/api-keys?reveal=true`);
  const key = keys.find((item) => item.type === "secret" && item.api_key?.startsWith("sb_secret_"))?.api_key ??
    keys.find((item) => item.name === "service_role" && item.api_key?.split(".").length === 3)?.api_key;
  if (!key) throw new Error("No server key is available to upload the private documents.");
  const db = createClient(`https://${ref}.supabase.co`, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const bucket = db.storage.from("workspace-documents");
  for (const { name, bytes } of documents) {
    const { error } = await bucket.upload(name, bytes, { contentType: "application/pdf", cacheControl: "0", upsert: true });
    if (error) throw new Error(`Could not upload ${name}.`);
    console.log(`Uploaded privately: ${name}`);
  }
} else if (command === "bootstrap-admin") {
  const result = await request(`/projects/${ref}/database/query`, { query: `
    with matches as (
      select id, email_confirmed_at from auth.users where lower(email) = lower('${email}')
    ), granted as (
      insert into public.user_roles(user_id, role)
      select id, 'super_admin' from matches
      where email_confirmed_at is not null and (select count(*) from matches) = 1
      on conflict(user_id) do update set role = excluded.role
      returning role
    )
    select (select count(*) from matches)::int as matching_accounts,
      (select role::text from granted) as role
  ` });
  console.log(result);
} else {
  const project = `/projects/${ref}`;
  const tables = await request(`${project}/database/query/read-only`, {
    query: "select tablename from pg_catalog.pg_tables where schemaname = 'public' order by tablename",
  });
  console.log({ project: ref, publicTables: tables });
  if (command === "apply") {
    const source = new URL("../supabase/migrations/", import.meta.url);
    const migrations = (await readdir(source)).filter((name) => /^\d{14}_.+\.sql$/.test(name)).sort();
    if (!migrations.length) throw new Error("No migration files found.");
    const installed = await request(`${project}/database/migrations`);
    const versions = new Set((installed ?? []).flatMap(({ version, name }) => [version, name]));
    if (tables.length && versions.size === 0) throw new Error("The target already has public tables and no migration history.");
    for (const file of migrations) {
      const version = file.slice(0, 14);
      if (versions.has(version) || versions.has(file.slice(0, -4))) continue;
      const query = await readFile(new URL(file, source), "utf8");
      await request(`${project}/database/migrations`, { name: file.slice(0, -4), query });
      console.log(`Applied ${file}`);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }
}
