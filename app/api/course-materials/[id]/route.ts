import { MATERIAL_BUCKET } from "@/lib/course-materials";
import { uuid } from "@/lib/forms";
import { session } from "@/lib/supabase";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await session();
  if (!current) return new Response(null,{ status:401 });
  const id = uuid.safeParse((await params).id);
  if (!id.success) return new Response(null,{ status:404 });
  const { data } = await current.db.from("course_materials").select("object_path,download_name").eq("id",id.data).maybeSingle();
  if (!data) return new Response(null,{ status:404 });
  const result = await current.db.storage.from(MATERIAL_BUCKET).createSignedUrl(data.object_path,60,{ download:data.download_name });
  if (result.error || !result.data) return new Response(null,{ status:404 });
  return new Response(null,{ status:302, headers:{
    Location:result.data.signedUrl,"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer",
  } });
}
