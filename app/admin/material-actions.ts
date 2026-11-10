"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MATERIAL_BUCKET, MATERIAL_LIMIT, MATERIAL_TYPES, materialExtension } from "@/lib/course-materials";
import { uuid, type FormState } from "@/lib/forms";
import { OPERATIONS } from "@/lib/model";
import { requireStaff } from "@/lib/supabase";

export async function prepareCourseMaterial(input: { course: string; title: string; filename: string; size: number }) {
  const { db } = await requireStaff(OPERATIONS);
  const parsed = z.object({ course: uuid, title: z.string().trim().min(2).max(120), filename: z.string().min(5).max(250),
    size: z.number().int().positive().max(MATERIAL_LIMIT) }).safeParse(input);
  if (!parsed.success) return { error: "Enter a title and choose a PDF, DOCX or PPTX file up to 20 MB." };
  const { course, title, filename } = parsed.data;
  const extension = materialExtension(filename);
  if (!extension) return { error: "Choose a PDF, Word or PowerPoint file." };
  const id = randomUUID();
  const path = `${id}.${extension}`;
  const name = filename.slice(0, -(extension.length + 1)).replace(/[^\w .-]/g, "_").trim().slice(0, 130);
  const { error } = await db.from("course_materials").insert({
    id, course_id: course, title, download_name: `${name || "course-material"}.${extension}`, object_path: path,
  });
  if (error) return { error: "Could not prepare the upload. Check the course and try again." };
  const { data } = await db.storage.from(MATERIAL_BUCKET).createSignedUploadUrl(path);
  revalidatePath("/admin/materials");
  if (!data) return { error: "Storage could not prepare an upload. Check the draft in Course materials." };
  return { id, path, token: data.token, mime: MATERIAL_TYPES[extension] };
}

export async function changeCourseMaterial(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await requireStaff(OPERATIONS);
  const id = uuid.safeParse(form.get("id"));
  const published = form.get("published");
  if (!id.success || (published !== "true" && published !== "false")) return { error: "Invalid material update." };
  const { error } = await db.rpc("set_course_material_visibility", { p_id: id.data, p_published: published === "true" });
  if (error) return { error: error.code === "P0001" ? error.message : "Could not update material visibility." };
  revalidatePath("/admin/materials");
  revalidatePath("/dashboard/documents");
  return { success: published === "true" ? "Published to the course." : "Material hidden from students." };
}
