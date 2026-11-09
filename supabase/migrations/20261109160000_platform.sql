create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.staff_role as enum ('super_admin', 'admin', 'finance', 'coordinator');
create type public.application_status as enum ('submitted', 'under_review', 'approved', 'rejected', 'awaiting_payment', 'payment_confirmed', 'enrolled');
create type public.payment_method as enum ('flutterwave', 'cash', 'transfer');
create type public.payment_status as enum ('pending', 'confirmed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  created_at timestamptz not null default now()
);
create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.staff_role not null,
  created_at timestamptz not null default now()
);
create table public.site_content (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('company','service','announcement','testimonial','faq','promotion')),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  summary text not null default '' check (char_length(summary) <= 600),
  body text not null default '' check (char_length(body) <= 8000),
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object'),
  position integer not null default 0,
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(kind, slug)
);
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 150),
  category text not null,
  summary text not null check (char_length(summary) <= 400),
  description text not null default '',
  objectives text[] not null default '{}',
  requirements text not null default '',
  schedule text not null default '',
  faq text not null default '',
  cover_url text,
  accent text not null default 'blue' check (accent in ('blue', 'gold')),
  mode text check (mode in ('physical', 'online', 'hybrid')),
  duration text,
  starts_at date,
  registration_deadline timestamptz,
  phase text not null default 'upcoming' check (phase in ('upcoming','starting_soon','running','completed')),
  published boolean not null default false,
  archived boolean not null default false,
  registrations_open boolean not null default false,
  fee_kobo bigint not null check (fee_kobo between 0 and 5000000000),
  capacity integer check (capacity > 0),
  reserved_count integer not null default 0 check (reserved_count >= 0),
  installment_min_kobo bigint check (installment_min_kobo > 0),
  identity_requested boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  unique(course_id, position)
);
create table public.course_batches (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  starts_at date,
  schedule text not null default '',
  accepting boolean not null default true,
  unique(course_id, name),
  unique(id, course_id)
);
create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 100),
  kind text not null check (kind in ('percent','fixed')),
  value bigint not null check (value > 0 and value <= 5000000000 and (kind <> 'percent' or value <= 100)),
  claim_limit integer check (claim_limit > 0),
  claimed integer not null default 0 check (claimed >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default false,
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create unique index discounts_one_active on public.discounts(course_id) where active;

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('OR-' || upper(replace(gen_random_uuid()::text, '-', ''))),
  user_id uuid not null references auth.users(id),
  course_id uuid not null references public.courses(id),
  preferred_batch_id uuid,
  status public.application_status not null default 'submitted',
  full_name text not null check (char_length(full_name) between 2 and 100),
  email text not null check (char_length(email) <= 254),
  phone text not null check (phone ~ '^\+?[0-9 ()-]{7,25}$'),
  whatsapp text check (whatsapp ~ '^\+?[0-9 ()-]{7,25}$'),
  date_of_birth date not null check (date_of_birth >= '1900-01-01' and date_of_birth <= current_date),
  gender text check (char_length(gender) <= 40),
  address text not null check (char_length(address) between 3 and 300),
  state text not null check (char_length(state) between 2 and 80),
  occupation text not null check (char_length(occupation) between 1 and 100),
  education text not null check (char_length(education) between 1 and 100),
  additional_info text not null default '' check (char_length(additional_info) <= 1200),
  rules_version text not null,
  terms_version text not null,
  privacy_version text not null,
  refund_version text not null,
  accepted_at timestamptz not null default now(),
  payment_method public.payment_method not null,
  transfer_reference text check (char_length(transfer_reference) <= 120),
  original_kobo bigint not null check (original_kobo >= 0),
  discount_kobo bigint not null check (discount_kobo between 0 and original_kobo),
  payable_kobo bigint generated always as (original_kobo - discount_kobo) stored,
  installment_min_kobo bigint check (installment_min_kobo > 0),
  discount_id uuid references public.discounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  foreign key(preferred_batch_id, course_id) references public.course_batches(id, course_id)
);
create unique index one_live_application on public.applications(user_id,course_id) where status <> 'rejected';
create index applications_course_status on public.applications(course_id,status,created_at desc);
create index applications_user_date on public.applications(user_id,created_at desc);
create table public.application_identity (
  application_id uuid primary key references public.applications(id) on delete cascade,
  photo_path text,
  nin_ciphertext text check (char_length(nin_ciphertext) <= 500),
  consent_at timestamptz not null default now(),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','needs_review')),
  verified_at timestamptz,
  check (photo_path is not null or nin_ciphertext is not null or verified_at is not null)
);
create table public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create table public.students (
  user_id uuid primary key references auth.users(id),
  student_number text not null unique default ('ORS-' || upper(replace(gen_random_uuid()::text, '-', ''))),
  created_at timestamptz not null default now()
);
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.students(user_id),
  application_id uuid not null unique references public.applications(id),
  course_id uuid not null references public.courses(id),
  batch_id uuid,
  status text not null default 'active' check (status in ('active','completed','withdrawn')),
  created_at timestamptz not null default now(),
  foreign key(batch_id, course_id) references public.course_batches(id, course_id)
);
create index enrollments_user on public.enrollments(user_id);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id),
  reference text not null unique default ('ORP-' || replace(gen_random_uuid()::text, '-', '')),
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  external_reference text check (char_length(external_reference) <= 160),
  provider_transaction_id text unique,
  checkout_url text,
  checkout_expires_at timestamptz,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create index payments_application on public.payments(application_id,created_at desc);
create unique index payments_manual_reference on public.payments(method,external_reference)
  where method in ('cash','transfer') and external_reference is not null;
create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id),
  receipt_number text not null unique default ('ORR-' || upper(replace(gen_random_uuid()::text, '-', ''))),
  issued_at timestamptz not null default now()
);
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications(user_id,created_at desc);
create table public.contact_enquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 100),
  email text not null check (char_length(email) between 5 and 254),
  topic text not null check (char_length(topic) between 2 and 120),
  message text not null check (char_length(message) between 10 and 2000),
  source_hash text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index enquiries_source on public.contact_enquiries(source_hash, created_at);

create function public.has_staff_role(variadic roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role::text = any(roles));
$$;
revoke all on function public.has_staff_role(text[]) from public;
grant execute on function public.has_staff_role(text[]) to anon, authenticated, service_role;

create function private.new_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,full_name) values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name',''),100))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger obsidian_profile_after_signup after insert on auth.users
for each row execute function private.new_profile();
insert into public.profiles(id, full_name) select id,left(coalesce(raw_user_meta_data->>'full_name',''),100) from auth.users;

create function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare previous jsonb; current_row jsonb;
begin
  previous := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  current_row := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  insert into public.audit_logs(actor_id,action,entity,entity_id,detail)
  values(auth.uid(),lower(tg_op),tg_table_name,
    coalesce(current_row->>'id',previous->>'id',current_row->>'user_id',previous->>'user_id',
      current_row->>'application_id',previous->>'application_id'),
    case tg_table_name
      when 'payments' then jsonb_build_object('before',previous->>'status','after',current_row->>'status',
        'method',current_row->>'method','amount_kobo',current_row->'amount_kobo')
      when 'applications' then jsonb_build_object('before',previous->>'status','after',current_row->>'status')
      when 'user_roles' then jsonb_build_object('before',previous->>'role','after',current_row->>'role')
      when 'courses' then jsonb_build_object('fee_before',previous->'fee_kobo','fee_after',current_row->'fee_kobo',
        'published',current_row->'published')
      else '{}'::jsonb end);
  return null;
end;
$$;
create trigger audit_payments after insert or update or delete on public.payments for each row execute function private.audit();
create trigger audit_application_status after update of status on public.applications for each row
when (old.status is distinct from new.status) execute function private.audit();
create trigger audit_role_changes after insert or update or delete on public.user_roles for each row execute function private.audit();
create trigger audit_course_changes after insert or update of fee_kobo,published,archived,registrations_open on public.courses
for each row execute function private.audit();
create trigger audit_discount_changes after insert or update of active,value,claim_limit,ends_at on public.discounts
for each row execute function private.audit();
create trigger audit_identity_review after update of verification_status on public.application_identity
for each row execute function private.audit();

do $$
declare t text;
begin
  foreach t in array array['profiles','user_roles','site_content','courses','course_modules','course_batches',
    'discounts','applications','application_identity','application_notes','students','enrollments','payments',
    'payment_receipts','audit_logs','notifications','contact_enquiries'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

grant select on public.site_content,public.courses,public.course_modules,public.course_batches to anon,authenticated;
grant select on public.profiles,public.user_roles,public.discounts,public.applications,public.application_identity,
  public.application_notes,public.students,public.enrollments,public.payments,public.payment_receipts,public.audit_logs,
  public.notifications,public.contact_enquiries to authenticated;
grant insert,update,delete on public.site_content,public.course_modules,public.course_batches to authenticated;
grant insert (slug,title,category,summary,description,objectives,requirements,schedule,faq,cover_url,accent,
  mode,duration,starts_at,registration_deadline,phase,published,archived,registrations_open,fee_kobo,capacity,
  installment_min_kobo,identity_requested) on public.courses to authenticated;
grant update (slug,title,category,summary,description,objectives,requirements,schedule,faq,cover_url,accent,
  mode,duration,starts_at,registration_deadline,phase,published,archived,registrations_open,fee_kobo,capacity,
  installment_min_kobo,identity_requested,updated_at) on public.courses to authenticated;
grant update (status,batch_id) on public.enrollments to authenticated;
grant update (resolved) on public.contact_enquiries to authenticated;

create policy profile_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.has_staff_role('super_admin','admin','coordinator'));
create policy role_read on public.user_roles for select to authenticated
using (user_id = (select auth.uid()) or public.has_staff_role('super_admin'));
create policy content_read on public.site_content for select to anon,authenticated
using (published or public.has_staff_role('super_admin','admin'));
create policy content_manage on public.site_content for all to authenticated
using (public.has_staff_role('super_admin','admin')) with check (public.has_staff_role('super_admin','admin'));
create policy course_read on public.courses for select to anon,authenticated
using ((published and not archived) or public.has_staff_role('super_admin','admin','coordinator','finance'));
create policy course_manage on public.courses for all to authenticated
using (public.has_staff_role('super_admin','admin','coordinator'))
with check (public.has_staff_role('super_admin','admin','coordinator'));
create policy module_read on public.course_modules for select to anon,authenticated
using (exists(select 1 from public.courses c where c.id=course_id));
create policy module_manage on public.course_modules for all to authenticated
using (public.has_staff_role('super_admin','admin','coordinator'))
with check (public.has_staff_role('super_admin','admin','coordinator'));
create policy batch_read on public.course_batches for select to anon,authenticated
using (exists(select 1 from public.courses c where c.id=course_id)
  and (accepting or public.has_staff_role('super_admin','admin','coordinator')));
create policy batch_manage on public.course_batches for all to authenticated
using (public.has_staff_role('super_admin','admin','coordinator'))
with check (public.has_staff_role('super_admin','admin','coordinator'));
create policy discounts_read on public.discounts for select to authenticated
using (public.has_staff_role('super_admin','admin','coordinator'));
create policy applications_read on public.applications for select to authenticated
using (user_id = (select auth.uid()) or public.has_staff_role('super_admin','admin','coordinator'));
create policy identities_read on public.application_identity for select to authenticated
using (public.has_staff_role('super_admin','admin','coordinator'));
create policy notes_read on public.application_notes for select to authenticated
using (public.has_staff_role('super_admin','admin','coordinator'));
create policy students_read on public.students for select to authenticated
using (user_id=(select auth.uid()) or public.has_staff_role('super_admin','admin','coordinator'));
create policy enrollments_read on public.enrollments for select to authenticated
using (user_id=(select auth.uid()) or public.has_staff_role('super_admin','admin','coordinator'));
create policy enrollments_manage on public.enrollments for update to authenticated
using (public.has_staff_role('super_admin','admin','coordinator'))
with check (public.has_staff_role('super_admin','admin','coordinator'));
create policy payments_read on public.payments for select to authenticated
using (public.has_staff_role('super_admin','admin','finance') or exists(
  select 1 from public.applications a where a.id=application_id and a.user_id=(select auth.uid())
));
create policy receipts_read on public.payment_receipts for select to authenticated
using (exists(select 1 from public.payments p where p.id=payment_id));
create policy audit_read on public.audit_logs for select to authenticated
using (public.has_staff_role('super_admin','admin') or
  (entity='payments' and public.has_staff_role('finance')));
create policy notification_read on public.notifications for select to authenticated
using (user_id=(select auth.uid()));
create policy enquiries_read on public.contact_enquiries for select to authenticated
using (public.has_staff_role('super_admin','admin'));
create policy enquiries_manage on public.contact_enquiries for update to authenticated
using (public.has_staff_role('super_admin','admin')) with check (public.has_staff_role('super_admin','admin'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('applicant-photos','applicant-photos',false,2097152,array['image/jpeg','image/png']),
  ('course-media','course-media',true,2097152,array['image/jpeg','image/png','image/webp']);
create policy photo_add on storage.objects for insert to authenticated
with check (bucket_id='applicant-photos' and split_part(name,'/',1)=(select auth.uid())::text);
create policy photo_view on storage.objects for select to authenticated
using (bucket_id='applicant-photos' and
  (split_part(name,'/',1)=(select auth.uid())::text or public.has_staff_role('super_admin','admin','coordinator')));
create policy photo_delete_unused on storage.objects for delete to authenticated
using (bucket_id='applicant-photos' and split_part(name,'/',1)=(select auth.uid())::text
  and not exists(select 1 from public.application_identity i where i.photo_path=name));
create policy course_media_view on storage.objects for select to anon,authenticated using (bucket_id='course-media');
create policy course_media_add on storage.objects for insert to authenticated
with check (bucket_id='course-media' and public.has_staff_role('super_admin','admin','coordinator'));
create policy course_media_delete on storage.objects for delete to authenticated
using (bucket_id='course-media' and public.has_staff_role('super_admin','admin','coordinator'));
