-- Serialize online confirmations with manual payments and other installments.
create function public.confirm_flutterwave(p_ref text,p_transaction text,p_amount bigint,p_currency text,
  p_source text)
returns text language plpgsql security definer set search_path = '' as $$
declare p public.payments; a public.applications; outcome text;
begin
  select * into p from public.payments where reference=p_ref and method='flutterwave';
  if not found then
    outcome := 'unknown_reference';
  else
    select * into a from public.applications where id=p.application_id for update;
    select * into p from public.payments where id=p.id for update;
    if p_amount is distinct from p.amount_kobo or p_currency is distinct from p.currency
      or p_transaction is null or p_transaction !~ '^[0-9]{1,30}$' then
      outcome := 'details_mismatch';
    elsif p.status='confirmed' then
      outcome := case when p.provider_transaction_id=p_transaction then 'duplicate' else 'reference_reused' end;
    else
      -- Two different applications can never consume the same provider transaction.
      perform pg_advisory_xact_lock(9101, hashtext(p_transaction));
      if exists(select 1 from public.payments where provider_transaction_id=p_transaction and id<>p.id) then
        outcome := 'transaction_reused';
      elsif p.status<>'pending' or a.status not in ('approved','awaiting_payment')
        or p.amount_kobo > a.payable_kobo-private.paid_total(a.id) then
        outcome := 'balance_review';
      else
        update public.payments set status='confirmed',confirmed_at=now(),provider_transaction_id=p_transaction
          where id=p.id returning * into p;
        perform private.finalise_payment(p,a);
        outcome := 'confirmed';
      end if;
    end if;
  end if;
  insert into public.audit_logs(action,entity,entity_id,detail)
    values('flutterwave_' || outcome,'payments',p.id::text,
      jsonb_build_object('source',p_source,'reference',p_ref,'transaction',p_transaction,
        'amount_kobo',p_amount,'currency',p_currency));
  return outcome;
end $$;
revoke all on function public.confirm_flutterwave(text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.confirm_flutterwave(text,text,bigint,text,text) to service_role;

-- Keep older deployments safe during the database and application rollout.
create or replace function public.confirm_flutterwave(p_ref text,p_transaction text,p_amount bigint,p_currency text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare outcome text;
begin
  outcome := public.confirm_flutterwave(p_ref,p_transaction,p_amount,p_currency,'legacy');
  if outcome not in ('confirmed','duplicate') then
    raise exception 'Payment does not match the checkout or needs finance review.';
  end if;
  return (select id from public.payments where reference=p_ref);
end $$;

create function public.log_flutterwave_event(p_action text,p_source text,p_ref text,p_transaction text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs(action,entity,entity_id,detail)
    values('flutterwave_' || p_action,'payments',
      (select id::text from public.payments where reference=p_ref),
      jsonb_strip_nulls(jsonb_build_object('source',p_source,'reference',p_ref,'transaction',p_transaction)));
$$;
revoke all on function public.log_flutterwave_event(text,text,text,text) from public,anon,authenticated;
grant execute on function public.log_flutterwave_event(text,text,text,text) to service_role;

alter table public.contact_enquiries add column notification_status text not null default 'queued'
  check (notification_status in ('queued','unconfigured','failed','sent'));

create function private.audit_enquiry() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs(actor_id,action,entity,entity_id,detail)
    values(auth.uid(),case when tg_op='INSERT' then 'enquiry_received' else 'enquiry_updated' end,
      'contact_enquiries',new.id::text,
      jsonb_build_object('resolved',new.resolved,'notification',new.notification_status));
  return null;
end $$;
create trigger audit_enquiry_created after insert on public.contact_enquiries
  for each row execute function private.audit_enquiry();
create trigger audit_enquiry_updated after update on public.contact_enquiries for each row
  when (old.resolved is distinct from new.resolved or old.notification_status is distinct from new.notification_status)
  execute function private.audit_enquiry();

drop function public.record_enquiry(text,text,text,text,text);
create function public.record_enquiry(p_name text,p_email text,p_topic text,p_message text,p_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare enquiry_id uuid;
begin
  perform pg_advisory_xact_lock(9102,hashtext(p_hash));
  select id into enquiry_id from public.contact_enquiries where source_hash=p_hash
    and created_at>now()-interval '10 minutes' and full_name=p_name and email=p_email
    and topic=p_topic and message=p_message order by created_at desc limit 1;
  if found then return enquiry_id; end if;
  if (select count(*) from public.contact_enquiries where source_hash=p_hash and created_at>now()-interval '1 hour')>=5
    then raise exception 'Too many recent enquiries. Please try later.'; end if;
  insert into public.contact_enquiries(full_name,email,topic,message,source_hash)
    values(p_name,p_email,p_topic,p_message,p_hash) returning id into enquiry_id;
  return enquiry_id;
end $$;
revoke all on function public.record_enquiry(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_enquiry(text,text,text,text,text) to service_role;
grant select (id,created_at,notification_status,full_name,email,topic,message,resolved),
  update (notification_status) on public.contact_enquiries to service_role;
