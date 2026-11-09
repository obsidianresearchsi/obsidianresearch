import { session } from "@/lib/supabase";

const files: Record<string, string> = {
  rules: "student-rules-and-regulations.pdf",
  agreement: "student-registration-form-print.pdf",
  guidelines: "brand-identity-and-creative-guidelines.pdf",
};

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const current = await session();
  if (!current) return new Response(null, { status: 401 });
  const slug = (await params).slug;
  if (!Object.hasOwn(files,slug)) return new Response(null, { status: 404 });
  const { data, error } = await current.db.storage.from("workspace-documents").createSignedUrl(files[slug], 90);
  if (error || !data) return new Response("This document is temporarily unavailable.", { status: 503 });
  return new Response(null, {
    status: 302,
    headers: { Location: data.signedUrl, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}
