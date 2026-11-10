"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { changeCourseMaterial, prepareCourseMaterial } from "@/app/admin/material-actions";
import { MATERIAL_BUCKET, MATERIAL_LIMIT, materialExtension } from "@/lib/course-materials";
import { Field, Notice, Select } from "./ui";

export function CourseMaterialUpload({ courses }: { courses: { id: string; title: string }[] }) {
  const router = useRouter();
  const lock = useRef(false);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<{ error?: string; success?: string }>({});

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || !file.size || file.size > MATERIAL_LIMIT || !materialExtension(file.name)) {
      setStatus({ error: "Choose a PDF, DOCX or PPTX file up to 20 MB." });
      return;
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) { setStatus({ error: "Storage is not configured." }); return; }
    lock.current = true;
    setWorking(true);
    setStatus({});
    try {
      const draft = await prepareCourseMaterial({ course: String(data.get("course")), title: String(data.get("title")), filename: file.name, size: file.size });
      if (!draft.token || !draft.path || !draft.id || !draft.mime) { setStatus({ error: draft.error || "Could not start the upload." }); return; }
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error } = await client.storage.from(MATERIAL_BUCKET).uploadToSignedUrl(draft.path,draft.token,file,{ contentType: draft.mime });
      if (error) { setStatus({ error: "The file upload could not be confirmed. Check the draft before trying again." }); return; }
      const visibility = new FormData();
      visibility.set("id",draft.id);
      visibility.set("published","true");
      const result = await changeCourseMaterial({}, visibility);
      setStatus(result.error ? { error: `File uploaded. ${result.error}` } : result);
      form.reset();
    } catch { setStatus({ error: "The upload was interrupted. Check your drafts before trying again." }); }
    finally { setWorking(false); lock.current = false; router.refresh(); }
  }

  return <form className="action-form" onSubmit={upload}>
    <fieldset className="network-fields stack" disabled={working}>
      <Select label="Course" name="course" required><option value="">Choose a course</option>
        {courses.map(({ id,title }) => <option value={id} key={id}>{title}</option>)}</Select>
      <Field name="title" label="Material title" required minLength={2} maxLength={120} />
      <Field type="file" name="file" label="Course file" accept=".pdf,.docx,.pptx" required hint="PDF, Word or PowerPoint up to 20 MB." />
      <button className="button button-primary" type="submit">{working ? "Uploading…" : "Upload and publish"}</button>
    </fieldset>
    {status.error && <Notice tone="error">{status.error}</Notice>}
    {status.success && <Notice tone="success">{status.success}</Notice>}
  </form>;
}
