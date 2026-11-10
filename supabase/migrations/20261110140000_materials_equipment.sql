create table public.course_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id),
  title text not null check (char_length(title) between 2 and 120),
  download_name text not null check (char_length(download_name) between 5 and 150),
  object_path text not null unique check (object_path in (id::text || '.pdf',id::text || '.docx',id::text || '.pptx')),
  uploaded_by uuid default auth.uid() references auth.users(id) on delete set null,
  published boolean not null default false,
  first_published_at timestamptz,
  created_at timestamptz not null default now()
);
create index course_materials_course on public.course_materials(course_id,created_at desc);
alter table public.course_materials enable row level security;
revoke all on public.course_materials from anon,authenticated;
grant select,insert(id,course_id,title,download_name,object_path) on public.course_materials to authenticated;
create policy course_materials_read on public.course_materials for select to authenticated using (
  public.has_staff_role('super_admin','admin','coordinator') or
  (published and exists(select 1 from public.enrollments e where e.user_id=(select auth.uid())
    and e.course_id=course_materials.course_id and e.status in ('active','completed')))
);
create policy course_materials_stage on public.course_materials for insert to authenticated with check (
  public.has_staff_role('super_admin','admin','coordinator') and uploaded_by=(select auth.uid()) and not published
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('course-materials','course-materials',false,20971520,array['application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation']);
create policy course_material_upload on storage.objects for insert to authenticated with check (
  bucket_id='course-materials' and public.has_staff_role('super_admin','admin','coordinator')
  and exists(select 1 from public.course_materials m where m.object_path=storage.objects.name
    and m.uploaded_by=(select auth.uid()) and not m.published)
);
create policy course_material_download on storage.objects for select to authenticated using (
  bucket_id='course-materials' and exists(select 1 from public.course_materials m where m.object_path=storage.objects.name)
);
create function public.set_course_material_visibility(p_id uuid,p_published boolean)
returns void language plpgsql security definer set search_path='' as $$
declare material public.course_materials;
begin
  if not public.has_staff_role('super_admin','admin','coordinator') then raise exception 'Access denied.'; end if;
  if p_published is null then raise exception 'Choose a valid visibility.'; end if;
  select * into material from public.course_materials where id=p_id for update;
  if not found then raise exception 'Material not found.'; end if;
  if p_published and not exists(select 1 from storage.objects where bucket_id='course-materials' and name=material.object_path)
    then raise exception 'Upload the file before publishing this material.'; end if;
  if material.published=p_published then return; end if;
  update public.course_materials set published=p_published,
    first_published_at=case when p_published then coalesce(first_published_at,now()) else first_published_at end where id=p_id;
  if p_published and material.first_published_at is null then
    insert into public.notifications(user_id,title,body)
      select e.user_id,'New course material',material.title from public.enrollments e
      where e.course_id=material.course_id and e.status='active' group by e.user_id;
  end if;
end $$;
revoke all on function public.set_course_material_visibility(uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_course_material_visibility(uuid,boolean) to authenticated;
create trigger audit_course_materials after insert or update on public.course_materials for each row execute function private.audit();

create table public.studio_equipment (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ap','router','switch','inverter')),
  brand text not null check (char_length(brand) between 1 and 45),
  model text not null check (char_length(model) between 1 and 65),
  price_kobo bigint check (price_kobo between 0 and 5000000000),
  radius_m integer,
  watts integer,
  surge_watts integer,
  voltage integer,
  photo_path text check (photo_path ~ '^[a-f0-9-]{36}\.(jpg|png|webp)$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((kind='ap' and radius_m is not null and radius_m between 20 and 600) or (kind<>'ap' and radius_m is null)),
  check ((kind='inverter' and watts is not null and surge_watts is not null and voltage is not null
    and watts between 500 and 50000 and surge_watts between watts and 100000 and voltage in (24,48))
    or (kind<>'inverter' and watts is null and surge_watts is null and voltage is null))
);
create unique index studio_equipment_model on public.studio_equipment(kind,lower(brand),lower(model));
alter table public.studio_equipment enable row level security;
revoke all on public.studio_equipment from anon,authenticated;
grant select on public.studio_equipment to anon,authenticated;
grant insert,update on public.studio_equipment to authenticated;
create policy studio_equipment_read on public.studio_equipment for select to anon,authenticated
using (active or public.has_staff_role('super_admin','admin'));
create policy studio_equipment_add on public.studio_equipment for insert to authenticated with check (public.has_staff_role('super_admin','admin'));
create policy studio_equipment_edit on public.studio_equipment for update to authenticated
using (public.has_staff_role('super_admin','admin')) with check (public.has_staff_role('super_admin','admin'));
create trigger audit_studio_equipment after insert or update on public.studio_equipment for each row execute function private.audit();
