insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('workspace-documents', 'workspace-documents', false, 10485760, array['application/pdf']);

create policy workspace_documents_read on storage.objects for select to authenticated
using (
  bucket_id = 'workspace-documents'
  and name in ('student-rules-and-regulations.pdf', 'student-registration-form-print.pdf', 'brand-identity-and-creative-guidelines.pdf')
);
