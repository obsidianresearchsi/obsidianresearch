alter table public.customer_messages add column network_plan jsonb
  check (network_plan is null or (jsonb_typeof(network_plan)='object' and octet_length(network_plan::text)<=16000));

create function public.submit_network_review(p_user uuid,p_submission uuid,p_body text,p_plan jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare thread uuid; service public.site_content;
begin
  if p_user is null or not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null) then
    raise exception 'Confirm your email before sending a network design.';
  end if;
  if p_submission is null or p_body is null or length(btrim(p_body)) not between 1 and 4000
    or p_plan is null or jsonb_typeof(p_plan)<>'object' or octet_length(p_plan::text)>16000 then
    raise exception 'Enter a valid network design.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,71004));
  select t.id into thread from public.customer_messages m join public.customer_threads t on t.id=m.thread_id
    where m.submission_key=p_submission and m.network_plan is not null and t.user_id=p_user;
  if found then return thread; end if;
  select * into service from public.site_content where kind='service' and slug='advanced-networking' and published;
  if not found then raise exception 'Network design is currently unavailable.'; end if;
  select id into thread from public.customer_threads
    where user_id=p_user and service_id=service.id and status in ('open','in_review','approved') for update;
  if not found then
    insert into public.customer_threads(user_id,service_id,subject,price_kobo)
    values(p_user,service.id,service.title,(service.details->>'price_kobo')::bigint) returning id into thread;
  else
    update public.customer_threads set updated_at=now() where id=thread;
  end if;
  insert into public.customer_messages(thread_id,from_staff,body,submission_key,network_plan)
    values(thread,false,btrim(p_body),p_submission,p_plan);
  return thread;
end $$;
revoke all on function public.submit_network_review(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_network_review(uuid,uuid,text,jsonb) to service_role;
