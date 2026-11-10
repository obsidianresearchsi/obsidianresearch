-- An online payment can settle before review. Only staff can approve admission.
create or replace function public.begin_checkout(p_id uuid,p_amount bigint default null)
returns table(id uuid,reference text,amount_kobo bigint,checkout_url text,created boolean)
language plpgsql security definer set search_path = '' as $$
declare a public.applications; p public.payments; amount bigint; due bigint; before_review boolean;
begin
  select * into a from public.applications where applications.id=p_id and user_id=auth.uid() for update;
  if not found then raise exception 'Payment is not open.'; end if;
  before_review := a.status in ('submitted','under_review');
  if a.status not in ('approved','awaiting_payment') and not (before_review and a.payment_method='flutterwave') then
    raise exception 'Payment is not open.';
  end if;
  select * into p from public.payments where application_id=p_id and method='flutterwave' and status='pending'
    and checkout_expires_at>now() order by created_at desc limit 1;
  if found then return query select p.id,p.reference,p.amount_kobo,p.checkout_url,false; return; end if;

  due := a.payable_kobo-private.paid_total(p_id);
  amount := coalesce(p_amount,due);
  if before_review and amount<>due then raise exception 'Pay the full balance before application approval.'; end if;
  perform private.validate_installment(a,amount);
  insert into public.payments(application_id,method,amount_kobo,checkout_expires_at)
    values(p_id,'flutterwave',amount,now()+interval '45 minutes') returning * into p;
  if not before_review then
    update public.applications set payment_method='flutterwave',status='awaiting_payment',updated_at=now() where applications.id=p_id;
  end if;
  return query select p.id,p.reference,p.amount_kobo,p.checkout_url,true;
end $$;

create or replace function public.confirm_flutterwave(p_ref text,p_transaction text,p_amount bigint,p_currency text,
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
      perform pg_advisory_xact_lock(9101, hashtext(p_transaction));
      if exists(select 1 from public.payments where provider_transaction_id=p_transaction and id<>p.id) then
        outcome := 'transaction_reused';
      elsif p.status<>'pending' or a.status not in ('submitted','under_review','approved','awaiting_payment')
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

create or replace function public.review_application(p_id uuid,p_status public.application_status,p_batch uuid,p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.applications; c public.courses; next_status public.application_status;
begin
  if not public.has_staff_role('super_admin','admin','coordinator') then raise exception 'Access denied.'; end if;
  select * into a from public.applications where id=p_id;
  if not found then raise exception 'Application not found.'; end if;
  select * into c from public.courses where id=a.course_id for update;
  select * into a from public.applications where id=p_id for update;
  if p_batch is not null and not exists(select 1 from public.course_batches where id=p_batch and course_id=a.course_id) then
    raise exception 'The batch does not belong to this course.';
  end if;
  if char_length(coalesce(p_note,''))>2000 then raise exception 'Note is too long.'; end if;
  next_status := coalesce(p_status,a.status);
  if next_status<>a.status and not (
    (a.status='submitted' and next_status in ('under_review','approved','rejected')) or
    (a.status='under_review' and next_status in ('approved','rejected')) or
    (a.status='approved' and next_status='awaiting_payment') or
    (a.status='payment_confirmed' and next_status='enrolled')
  ) then raise exception 'This status change is not available.'; end if;
  if next_status='approved' and private.paid_total(a.id)>=a.payable_kobo then next_status:='payment_confirmed'; end if;
  if next_status='rejected' and a.status<>next_status then
    if exists(select 1 from public.payments where application_id=p_id and method='flutterwave'
      and status='pending' and checkout_expires_at>now()) then
      raise exception 'A Flutterwave checkout is active. Wait for it to close before rejecting this application.';
    end if;
    if private.paid_total(a.id)>0 then
      if not public.has_staff_role('super_admin','admin') or nullif(trim(p_note),'') is null then
        raise exception 'Coordinate with finance. An administrator must record a note before rejecting a paid application.';
      end if;
      insert into public.audit_logs(actor_id,action,entity,entity_id,detail)
        values(auth.uid(),'paid_application_rejected','applications',a.id::text,
          jsonb_build_object('reference',a.reference,'confirmed_kobo',private.paid_total(a.id)));
    end if;
    update public.courses set reserved_count=greatest(reserved_count-1,0) where id=a.course_id;
  end if;
  if next_status='enrolled' then
    insert into public.students(user_id) values(a.user_id) on conflict(user_id) do nothing;
    insert into public.enrollments(user_id,application_id,course_id,batch_id)
      values(a.user_id,a.id,a.course_id,coalesce(p_batch,a.preferred_batch_id))
      on conflict(application_id) do update set batch_id=excluded.batch_id;
  end if;
  update public.applications set status=next_status,
    preferred_batch_id=coalesce(p_batch,preferred_batch_id),
    reviewed_at=now(),updated_at=now() where id=p_id;
  if nullif(trim(p_note),'') is not null then
    insert into public.application_notes(application_id,author_id,body) values(p_id,auth.uid(),trim(p_note));
  end if;
  if next_status<>a.status then
    insert into public.notifications(user_id,title,body)
      values(a.user_id,'Application updated',replace(initcap(next_status::text),'_',' ') || ' • ' || a.reference);
  end if;
end $$;

create or replace function public.finance_accounts()
returns table(id uuid,reference text,full_name text,course_id uuid,course_title text,status public.application_status,
  payment_method public.payment_method,transfer_reference text,original_kobo bigint,discount_kobo bigint,
  payable_kobo bigint,paid_kobo bigint,created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.id,a.reference,a.full_name,a.course_id,c.title,a.status,a.payment_method,a.transfer_reference,
    a.original_kobo,a.discount_kobo,a.payable_kobo,private.paid_total(a.id),a.created_at
  from public.applications a join public.courses c on c.id=a.course_id
  where public.has_staff_role('super_admin','admin','finance')
    and (a.status in ('approved','awaiting_payment','payment_confirmed','enrolled')
      or exists(select 1 from public.payments p where p.application_id=a.id and p.method='flutterwave'));
$$;

update public.site_content
set summary='When Flutterwave is available, it opens a secure checkout after you submit. Cash and bank transfer instructions appear in your dashboard after approval.'
where kind='faq' and slug='payment-options'
  and summary='Choose Flutterwave online checkout, cash at the training centre or bank transfer. The dashboard shows the next step once your application is approved.';
