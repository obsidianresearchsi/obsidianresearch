"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus } from "lucide-react";
import { uploadEditorialImage } from "@/app/admin/editorial-actions";
import { Field, Textarea } from "@/components/ui";

export function EditorialFields({ cover, alt, initialBody }: { cover: string; alt: string; initialBody: string }) {
  const [image, setImage] = useState(cover);
  const [imageAlt, setImageAlt] = useState(alt);
  const [body, setBody] = useState(initialBody);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const [description, setDescription] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const target = useRef<"cover" | "body">("cover");
  return <div className="stack">
    <input name="cover_url" type="hidden" value={image} />
    <input type="file" accept="image/png,image/jpeg,image/webp" ref={fileInput} hidden onChange={(event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const placement = target.current;
      start(async () => {
        setMessage("");
        const upload = new FormData();
        upload.set("image", file);
        try {
          const result = await uploadEditorialImage(upload);
          if (!result.url) { setMessage(result.error ?? "Upload failed."); return; }
          if (placement === "cover") setImage(result.url);
          else {
            const label = description.trim().replace(/[\[\]\r\n]/g, "");
            setBody((current) => `${current.trimEnd()}\n\n![${label}](${result.url})\n\n`.trimStart());
            setDescription("");
          }
          setMessage("Picture added. Save the content to keep it.");
        } catch { setMessage("Upload failed. Try again."); }
      });
    }} />
    {image && <img className="editorial-preview" src={image} alt={imageAlt} />}
    <div className="row">
      <button className="button button-ghost" type="button" disabled={pending} onClick={() => { target.current = "cover"; fileInput.current?.click(); }}>
        <ImagePlus size={16} aria-hidden /> {image ? "Replace cover" : "Upload cover picture"}
      </button>
      {image && <button className="text-link" type="button" onClick={() => setImage("")}>Remove cover</button>}
    </div>
    <Field label="Cover picture description" name="cover_alt" value={imageAlt} onChange={(event) => setImageAlt(event.target.value)} maxLength={180} />
    <Textarea label="Article body" name="body" value={body} onChange={(event) => setBody(event.target.value)}
      maxLength={40000} rows={13} hint="Leave a blank line between paragraphs. Use ## for headings, > for quotes, and - for list items." required />
    <div className="row editorial-upload">
      <Field label="Article picture description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={180} />
      <button className="button button-ghost" type="button" disabled={pending || !description.trim()}
        onClick={() => { target.current = "body"; fileInput.current?.click(); }}><ImagePlus size={16} aria-hidden /> Add picture to article</button>
    </div>
    <p className="small muted" role="status">{pending ? "Uploading picture…" : message || "JPEG, PNG, or WebP, up to 2 MB."}</p>
  </div>;
}
