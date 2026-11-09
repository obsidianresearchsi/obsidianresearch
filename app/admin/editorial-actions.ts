"use server";

import { randomUUID } from "node:crypto";
import { CONTENT } from "@/lib/model";
import { requireStaff } from "@/lib/supabase";

export async function uploadEditorialImage(form: FormData) {
  const { db } = await requireStaff(CONTENT);
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0 || file.size > 2_097_152) return { error: "Choose a picture up to 2 MB." };
  const bytes = Buffer.from(await file.arrayBuffer());
  const format = file.type === "image/png" && bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) ? "png"
    : file.type === "image/jpeg" && bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex")) ? "jpg"
    : file.type === "image/webp" && bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP" ? "webp" : null;
  if (!format) return { error: "Choose a JPEG, PNG, or WebP picture." };
  const path = `${randomUUID()}.${format}`;
  const bucket = db.storage.from("editorial-media");
  const { error } = await bucket.upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) return { error: "Could not upload the picture. Try again." };
  return { url: bucket.getPublicUrl(path).data.publicUrl };
}
