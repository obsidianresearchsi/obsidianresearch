alter table public.site_content drop constraint site_content_kind_check;
alter table public.site_content add constraint site_content_kind_check
  check (kind in ('company','service','announcement','testimonial','faq','promotion','article'));
alter table public.site_content drop constraint site_content_body_check;
alter table public.site_content add constraint site_content_body_check
  check (length(body)<=case when kind='article' then 40000 else 8000 end);
alter table public.site_content add constraint service_price_is_valid check (
  kind <> 'service' or not (details ? 'price_kobo') or
  case when jsonb_typeof(details->'price_kobo') = 'number'
    then (details->>'price_kobo') ~ '^[0-9]{1,10}$' and (details->>'price_kobo')::numeric <= 5000000000
    else false end
);
update public.site_content set details=details || '{"email":"obsidianresearch.si@gmail.com"}'::jsonb
where kind='company' and slug='profile';

insert into public.site_content(kind,slug,title,summary,body,position,published)
values ('service','solar-power','Solar & Backup Power','Request a quote for solar or backup power.',
  'Tell us where you need power, what equipment you want to run, and how long you need backup. The team can review your requirements and discuss the next steps.',90,true)
on conflict(kind,slug) do nothing;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('editorial-media','editorial-media',true,2097152,array['image/jpeg','image/png','image/webp']);
create policy editorial_upload on storage.objects for insert to authenticated
with check (bucket_id='editorial-media' and public.has_staff_role('super_admin','admin'));
create policy editorial_select on storage.objects for select to authenticated
using (bucket_id='editorial-media' and public.has_staff_role('super_admin','admin'));
create policy editorial_delete on storage.objects for delete to authenticated
using (bucket_id='editorial-media' and public.has_staff_role('super_admin','admin'));

create table public.customer_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_id uuid references public.site_content(id) on delete restrict,
  subject text not null check (length(subject) between 1 and 160),
  price_kobo bigint check (price_kobo between 0 and 5000000000),
  status text not null default 'open' check (status in ('open','in_review','approved','completed','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_threads_owner on public.customer_threads(user_id,updated_at desc);
create index customer_threads_recent on public.customer_threads(updated_at desc);
create unique index customer_threads_active_service on public.customer_threads(user_id,service_id)
where service_id is not null and status in ('open','in_review','approved');
create unique index customer_threads_active_chat on public.customer_threads(user_id)
where service_id is null and status in ('open','in_review','approved');

create table public.customer_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.customer_threads(id) on delete cascade,
  from_staff boolean not null,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index customer_messages_thread on public.customer_messages(thread_id,id);

alter table public.customer_threads enable row level security;
alter table public.customer_messages enable row level security;
revoke all on public.customer_threads,public.customer_messages from public,anon,authenticated;
grant select on public.customer_threads,public.customer_messages to authenticated;
grant all on public.customer_threads,public.customer_messages to service_role;
create policy customer_thread_read on public.customer_threads for select to authenticated
using (user_id=(select auth.uid()) or public.has_staff_role('super_admin','admin','coordinator'));
create policy customer_message_read on public.customer_messages for select to authenticated
using (exists(select 1 from public.customer_threads t where t.id=thread_id));

create function public.start_customer_thread(p_service uuid,p_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); service public.site_content; thread uuid;
begin
  if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then
    raise exception 'Confirm your email before starting a conversation.';
  end if;
  if p_body is null or length(btrim(p_body)) not between 1 and 4000 then
    raise exception 'Enter a message between 1 and 4,000 characters.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,71004));
  select id into thread from public.customer_threads
    where user_id=uid and service_id is not distinct from p_service and status in ('open','in_review','approved');
  if found then return thread; end if;
  if p_service is not null then
    select * into service from public.site_content where id=p_service and kind='service' and published;
    if not found then raise exception 'This service is currently unavailable.'; end if;
  end if;
  insert into public.customer_threads(user_id,service_id,subject,price_kobo)
  values(uid,p_service,coalesce(service.title,'General support'),(service.details->>'price_kobo')::bigint)
  returning id into thread;
  insert into public.customer_messages(thread_id,from_staff,body) values(thread,false,btrim(p_body));
  return thread;
end $$;

create function public.reply_customer_thread(p_thread uuid,p_body text)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); thread public.customer_threads; staff boolean;
begin
  staff := public.has_staff_role('super_admin','admin','coordinator');
  select * into thread from public.customer_threads where id=p_thread
    and (user_id=uid or staff) for update;
  if not found then raise exception 'Conversation unavailable.'; end if;
  if thread.status in ('closed','completed') then raise exception 'This conversation is closed.'; end if;
  if p_body is null or length(btrim(p_body)) not between 1 and 4000 then
    raise exception 'Enter a message between 1 and 4,000 characters.';
  end if;
  insert into public.customer_messages(thread_id,from_staff,body)
    values(p_thread,thread.user_id<>uid and staff,btrim(p_body));
  update public.customer_threads set updated_at=now() where id=p_thread;
end $$;

create function public.set_customer_thread_status(p_thread uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.has_staff_role('super_admin','admin','coordinator') then raise exception 'Access denied.'; end if;
  if p_status not in ('open','in_review','approved','completed','closed') or p_status is null then
    raise exception 'Choose a valid status.';
  end if;
  update public.customer_threads set status=p_status,updated_at=now() where id=p_thread;
  if not found then raise exception 'Conversation unavailable.'; end if;
end $$;

revoke all on function public.start_customer_thread(uuid,text), public.reply_customer_thread(uuid,text),
  public.set_customer_thread_status(uuid,text) from public,anon,authenticated;
grant execute on function public.start_customer_thread(uuid,text), public.reply_customer_thread(uuid,text),
  public.set_customer_thread_status(uuid,text) to authenticated;

create table public.flutterwave_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  secret_ciphertext text,
  webhook_ciphertext text,
  updated_at timestamptz not null default now()
);
insert into public.flutterwave_settings(id) values(true);
alter table public.flutterwave_settings enable row level security;
revoke all on public.flutterwave_settings from public,anon,authenticated;
grant select,insert,update on public.flutterwave_settings to service_role;
