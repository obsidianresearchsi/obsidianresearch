"use client";

import { useState } from "react";
import { uploadEditorialImage } from "@/app/admin/editorial-actions";
import { Field } from "./ui";

export function PortfolioMediaFields({ image, video, project }: { image: string; video: string; project: string }) {
  const [url, setUrl] = useState(image);
  const [status, setStatus] = useState("");
  return <div className="stack">
    <Field label="Project link" name="project_url" defaultValue={project} maxLength={1000} placeholder="https://example.com/project" />
    <Field label="Cover image URL" name="portfolio_image" value={url} maxLength={1000} onChange={(event) => setUrl(event.target.value)} />
    <Field label="Upload a cover image" type="file" accept="image/jpeg,image/png,image/webp" hint="JPG, PNG or WebP up to 2 MB." onChange={async (event) => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      const data = new FormData();
      data.set("image", file);
      setStatus("Uploading image…");
      try {
        const result = await uploadEditorialImage(data);
        if (result.url) setUrl(result.url);
        setStatus(result.url ? "Image ready. Save the project to use it." : result.error ?? "Image upload failed.");
      } catch { setStatus("Image upload failed. Try again."); }
    }} />
    {status && <p className="small muted" role="status">{status}</p>}
    <Field label="Video URL" name="portfolio_video" defaultValue={video} maxLength={1000}
      hint="Use a direct MP4 or WebM URL to play it in the 3D gallery, or a YouTube or Vimeo link to open a player alongside it." />
  </div>;
}
