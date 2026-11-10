alter table public.customer_messages
  add column submission_key uuid,
  add column attachment_path text,
  add constraint customer_message_render_requires_submission check (attachment_path is null or submission_key is not null);
create unique index customer_messages_submission_key on public.customer_messages(submission_key) where submission_key is not null;
create unique index customer_messages_render on public.customer_messages(attachment_path) where attachment_path is not null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('interior-renders','interior-renders',false,1500000,array['image/jpeg']);
create policy interior_render_upload on storage.objects for insert to authenticated with check (
  bucket_id='interior-renders' and split_part(name,'/',1)=(select auth.uid())::text
  and split_part(name,'/',2) ~ '^[a-f0-9-]{36}\.jpg$' and array_length(string_to_array(name,'/'),1)=2
);
create policy interior_render_read on storage.objects for select to authenticated using (
  bucket_id='interior-renders' and exists(
    select 1 from public.customer_messages m where m.attachment_path=storage.objects.name
  )
);

create function public.submit_interior_review(p_submission uuid,p_body text,p_image text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); thread uuid; service public.site_content;
begin
  if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then
    raise exception 'Confirm your email before sending a design for review.';
  end if;
  if p_submission is null or p_body is null or length(btrim(p_body)) not between 1 and 4000 then
    raise exception 'Enter a valid interior design brief.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,71004));
  select t.id into thread from public.customer_messages m
    join public.customer_threads t on t.id=m.thread_id
    where m.submission_key=p_submission and t.user_id=uid;
  if found then return thread; end if;

  if p_image is not null and (p_image <> uid::text || '/' || p_submission::text || '.jpg' or not exists(
    select 1 from storage.objects where bucket_id='interior-renders' and name=p_image
  )) then
    raise exception 'The design image could not be verified.';
  end if;
  select * into service from public.site_content where kind='service' and slug='interior-design' and published;
  if not found then raise exception 'Interior design is currently unavailable.'; end if;
  select id into thread from public.customer_threads
    where user_id=uid and service_id=service.id and status in ('open','in_review','approved') for update;
  if not found then
    insert into public.customer_threads(user_id,service_id,subject,price_kobo)
    values(uid,service.id,service.title,(service.details->>'price_kobo')::bigint) returning id into thread;
  else
    update public.customer_threads set updated_at=now() where id=thread;
  end if;
  insert into public.customer_messages(thread_id,from_staff,body,submission_key,attachment_path)
    values(thread,false,btrim(p_body),p_submission,p_image);
  return thread;
end $$;

revoke all on function public.submit_interior_review(uuid,text,text) from public,anon,authenticated;
grant execute on function public.submit_interior_review(uuid,text,text) to authenticated;
