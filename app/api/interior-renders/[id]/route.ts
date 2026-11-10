import { INTERIOR_RENDER_BUCKET } from "@/lib/interior";
import { session } from "@/lib/supabase";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await session();
  if (!current) return new Response(null, { status: 401 });
  const { id } = await params;
  if (!/^\d{1,15}$/.test(id)) return new Response(null, { status: 404 });
  const { data } = await current.db.from("customer_messages").select("attachment_path").eq("id", id).maybeSingle();
  if (!data?.attachment_path) return new Response(null, { status: 404 });
  const result = await current.db.storage.from(INTERIOR_RENDER_BUCKET).createSignedUrl(data.attachment_path, 90);
  if (result.error || !result.data) return new Response(null, { status: 404 });
  return new Response(null, { status: 302, headers: {
    Location: result.data.signedUrl, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer",
  } });
}
