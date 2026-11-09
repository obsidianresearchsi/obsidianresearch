create function public.photo_attached(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.application_identity i
    join public.applications a on a.id=i.application_id
    where i.photo_path=path and a.user_id=auth.uid());
$$;
revoke all on function public.photo_attached(text) from public;
grant execute on function public.photo_attached(text) to authenticated;
alter policy photo_delete_unused on storage.objects using
  (bucket_id='applicant-photos' and split_part(name,'/',1)=(select auth.uid())::text and not public.photo_attached(name));

create function public.public_offers() returns table
  (course_id uuid, label text, kind text, value bigint, claim_limit integer, remaining integer, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.course_id,d.label,d.kind,d.value,d.claim_limit,
    case when d.claim_limit is null then null else d.claim_limit-d.claimed end,d.ends_at
  from public.discounts d join public.courses c on c.id=d.course_id
  where c.published and not c.archived and c.registrations_open and c.phase in ('upcoming','starting_soon')
    and (c.capacity is null or c.reserved_count < c.capacity)
    and (c.registration_deadline is null or c.registration_deadline > now())
    and d.active and (d.claim_limit is null or d.claimed < d.claim_limit)
    and (d.starts_at is null or d.starts_at <= now()) and (d.ends_at is null or d.ends_at > now());
$$;

create function public.submit_application(p_course uuid, p_data jsonb)
returns table(id uuid, reference text, payable_kobo bigint)
language plpgsql security definer set search_path = '' as $$
declare
  applicant uuid := auth.uid(); confirmed_email text;
  c public.courses; promo public.discounts; a public.applications;
  batch uuid := nullif(p_data->>'preferred_batch_id','')::uuid;
  photo text := nullif(p_data->>'photo_path','');
  nin text := nullif(p_data->>'nin_ciphertext','');
  saving bigint := 0;
begin
  select email into confirmed_email from auth.users where auth.users.id=applicant and email_confirmed_at is not null;
  if confirmed_email is null then raise exception 'A confirmed email account is required.'; end if;
  if not (p_data @> '{"rules":true,"terms":true,"privacy":true,"refund":true}'::jsonb) then
    raise exception 'Please acknowledge all four policies.';
  end if;
  select * into c from public.courses where courses.id=p_course for update;
  if not found then raise exception 'Course not found.'; end if;
  select * into a from public.applications
    where user_id=applicant and course_id=p_course and status<>'rejected';
  if found then return query select a.id,a.reference,a.payable_kobo; return; end if;
  if not c.published or c.archived or not c.registrations_open or c.phase not in ('upcoming','starting_soon')
    or (c.registration_deadline is not null and c.registration_deadline<=now()) then
    raise exception 'Registration is closed.';
  end if;
  if c.capacity is not null and c.reserved_count>=c.capacity then raise exception 'This course is fully booked.'; end if;
  if batch is not null and not exists(select 1 from public.course_batches b where b.id=batch and b.course_id=p_course and b.accepting)
    then raise exception 'Select an available training batch.'; end if;
  if photo is not null or nin is not null then
    if not c.identity_requested or not (p_data @> '{"identity_consent":true}'::jsonb) then
      raise exception 'Identity evidence requires an active request and separate consent.';
    end if;
    if photo is not null and (split_part(photo,'/',1)<>applicant::text or not exists(
      select 1 from storage.objects o where o.bucket_id='applicant-photos' and o.name=photo))
      then raise exception 'Passport photo could not be verified.'; end if;
    if nin is not null and nin !~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' then
      raise exception 'Identity evidence is invalid.';
    end if;
  end if;
  select * into promo from public.discounts d where d.course_id=p_course and d.active
    and (d.starts_at is null or d.starts_at<=now()) and (d.ends_at is null or d.ends_at>now())
    and (d.claim_limit is null or d.claimed<d.claim_limit) for update;
  if found then
    saving := least(c.fee_kobo,case when promo.kind='percent' then c.fee_kobo*promo.value/100 else promo.value end);
    if saving>0 then update public.discounts set claimed=claimed+1 where discounts.id=promo.id; end if;
  end if;
  insert into public.applications(user_id,course_id,preferred_batch_id,full_name,email,phone,whatsapp,
    date_of_birth,gender,address,state,occupation,education,additional_info,rules_version,terms_version,
    privacy_version,refund_version,payment_method,original_kobo,discount_kobo,discount_id,installment_min_kobo)
  values(applicant,p_course,batch,trim(p_data->>'full_name'),confirmed_email,trim(p_data->>'phone'),
    nullif(trim(p_data->>'whatsapp'),''),(p_data->>'date_of_birth')::date,nullif(trim(p_data->>'gender'),''),
    trim(p_data->>'address'),trim(p_data->>'state'),trim(p_data->>'occupation'),trim(p_data->>'education'),
    coalesce(trim(p_data->>'additional_info'),''),'1.0','1.0','1.0','1.0',
    (p_data->>'payment_method')::public.payment_method,c.fee_kobo,saving,promo.id,c.installment_min_kobo)
  returning * into a;
  if photo is not null or nin is not null then
    insert into public.application_identity(application_id,photo_path,nin_ciphertext) values(a.id,photo,nin);
  end if;
  update public.courses set reserved_count=reserved_count+1 where courses.id=p_course;
  update public.profiles set full_name=a.full_name where profiles.id=applicant;
  insert into public.notifications(user_id,title,body) values(applicant,'Application received',a.reference);
  return query select a.id,a.reference,a.payable_kobo;
end $$;

create function public.review_application(p_id uuid,p_status public.application_status,p_batch uuid,p_note text)
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
  if next_status='approved' and a.payable_kobo=0 then next_status:='payment_confirmed'; end if;
  if next_status='rejected' and a.status<>next_status then
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

create function public.choose_payment(p_id uuid,p_method public.payment_method,p_reference text)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.applications;
begin
  select * into a from public.applications where id=p_id and user_id=auth.uid() for update;
  if not found or a.status not in ('approved','awaiting_payment') then raise exception 'Payment is not open.'; end if;
  if p_method<>'flutterwave' and exists(select 1 from public.payments where application_id=p_id
    and method='flutterwave' and status='pending' and checkout_expires_at>now()) then
    raise exception 'An online checkout is still active. Wait for it to expire before switching payment methods.';
  end if;
  update public.applications set payment_method=p_method,
    transfer_reference=case when p_method='transfer' then nullif(trim(p_reference),'') else null end,
    status='awaiting_payment',updated_at=now() where id=p_id;
end $$;

create function private.paid_total(p_id uuid) returns bigint
language sql stable set search_path = '' as $$
  select coalesce(sum(amount_kobo),0)::bigint from public.payments where application_id=p_id and status='confirmed';
$$;

create function private.validate_installment(a public.applications, amount bigint) returns void
language plpgsql set search_path = '' as $$
declare due bigint := greatest(a.payable_kobo-private.paid_total(a.id),0);
begin
  if amount is null or amount<=0 or amount>due then raise exception 'The amount exceeds the balance or is invalid.'; end if;
  if amount<due and (a.installment_min_kobo is null or amount<a.installment_min_kobo) then
    raise exception 'Pay the balance in full or enter an eligible installment.';
  end if;
end $$;

create function public.begin_checkout(p_id uuid,p_amount bigint default null)
returns table(id uuid,reference text,amount_kobo bigint,checkout_url text,created boolean)
language plpgsql security definer set search_path = '' as $$
declare a public.applications; p public.payments; amount bigint;
begin
  select * into a from public.applications where applications.id=p_id and user_id=auth.uid() for update;
  if not found or a.status not in ('approved','awaiting_payment') then raise exception 'Payment is not open.'; end if;
  select * into p from public.payments where application_id=p_id and method='flutterwave' and status='pending'
    and checkout_expires_at>now() order by created_at desc limit 1;
  if found then return query select p.id,p.reference,p.amount_kobo,p.checkout_url,false; return; end if;
  amount := coalesce(p_amount,a.payable_kobo-private.paid_total(p_id));
  perform private.validate_installment(a,amount);
  insert into public.payments(application_id,method,amount_kobo,checkout_expires_at)
    values(p_id,'flutterwave',amount,now()+interval '45 minutes') returning * into p;
  update public.applications set payment_method='flutterwave',status='awaiting_payment',updated_at=now() where applications.id=p_id;
  return query select p.id,p.reference,p.amount_kobo,p.checkout_url,true;
end $$;

create function private.finalise_payment(p public.payments,a public.applications) returns void
language plpgsql set search_path = '' as $$
begin
  insert into public.payment_receipts(payment_id) values(p.id) on conflict(payment_id) do nothing;
  if private.paid_total(a.id)>=a.payable_kobo and a.status in ('approved','awaiting_payment') then
    update public.applications set status='payment_confirmed',updated_at=now() where id=a.id;
  end if;
  insert into public.notifications(user_id,title,body) values(a.user_id,'Payment confirmed',p.reference);
end $$;

create function public.confirm_flutterwave(p_ref text,p_transaction text,p_amount bigint,p_currency text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.payments; a public.applications;
begin
  select * into p from public.payments where reference=p_ref and method='flutterwave';
  if not found then raise exception 'Payment reference not found.'; end if;
  select * into a from public.applications where id=p.application_id for update;
  select * into p from public.payments where id=p.id for update;
  if p_amount is distinct from p.amount_kobo or p_currency is distinct from p.currency
    or p_transaction is null or p_transaction !~ '^[0-9]{1,30}$' then
    raise exception 'Payment amount, currency, or transaction ID does not match.';
  end if;
  if p.status='confirmed' then
    if p.provider_transaction_id=p_transaction then return p.id; end if;
    raise exception 'Payment reference is already linked to another transaction.';
  end if;
  update public.payments set status='confirmed',confirmed_at=now(),provider_transaction_id=p_transaction
    where id=p.id returning * into p;
  perform private.finalise_payment(p,a);
  return p.id;
end $$;

create function public.record_manual_payment(p_id uuid,p_method public.payment_method,p_amount bigint,p_reference text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.payments; a public.applications; ref text := nullif(trim(p_reference),'');
begin
  if not public.has_staff_role('super_admin','admin','finance') then raise exception 'Access denied.'; end if;
  if p_method is null or p_method not in ('cash','transfer') or ref is null then
    raise exception 'Enter a cash receipt or bank transfer reference.';
  end if;
  select * into a from public.applications where id=p_id for update;
  if not found then raise exception 'Application not found.'; end if;
  select * into p from public.payments where method=p_method and external_reference=ref;
  if found then
    if p.application_id=p_id and p.amount_kobo=p_amount then return p.id; end if;
    raise exception 'That payment reference is already in use.';
  end if;
  if a.status not in ('approved','awaiting_payment') then raise exception 'Payment is not open.'; end if;
  if exists(select 1 from public.payments where application_id=p_id and method='flutterwave' and status='pending'
    and checkout_expires_at>now()) then raise exception 'Reconcile the active online checkout before recording another payment.'; end if;
  perform private.validate_installment(a,p_amount);
  insert into public.payments(application_id,method,amount_kobo,external_reference,status,recorded_by,confirmed_at)
    values(p_id,p_method,p_amount,ref,'confirmed',auth.uid(),now()) returning * into p;
  perform private.finalise_payment(p,a);
  return p.id;
end $$;

create function public.finance_accounts()
returns table(id uuid,reference text,full_name text,course_id uuid,course_title text,status public.application_status,
  payment_method public.payment_method,transfer_reference text,original_kobo bigint,discount_kobo bigint,
  payable_kobo bigint,paid_kobo bigint,created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.id,a.reference,a.full_name,a.course_id,c.title,a.status,a.payment_method,a.transfer_reference,
    a.original_kobo,a.discount_kobo,a.payable_kobo,private.paid_total(a.id),a.created_at
  from public.applications a join public.courses c on c.id=a.course_id
  where public.has_staff_role('super_admin','admin','finance')
    and a.status in ('approved','awaiting_payment','payment_confirmed','enrolled');
$$;

create function public.save_discount(p_course uuid,p_id uuid,p_label text,p_kind text,p_value bigint,
  p_limit integer,p_start timestamptz,p_end timestamptz,p_active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if not public.has_staff_role('super_admin','admin','coordinator') then raise exception 'Access denied.'; end if;
  perform 1 from public.courses where id=p_course for update;
  if not found then raise exception 'Course not found.'; end if;
  if p_active then update public.discounts set active=false where course_id=p_course and active and id is distinct from p_id; end if;
  if p_id is null then
    insert into public.discounts(course_id,label,kind,value,claim_limit,starts_at,ends_at,active)
      values(p_course,p_label,p_kind,p_value,p_limit,p_start,p_end,p_active) returning id into result;
  else
    update public.discounts set label=p_label,kind=p_kind,value=p_value,claim_limit=p_limit,starts_at=p_start,
      ends_at=p_end,active=p_active where id=p_id and course_id=p_course returning id into result;
  end if;
  if result is null then raise exception 'Discount not found.'; end if;
  return result;
end $$;

create function public.manage_staff(p_email text,p_role public.staff_role)
returns void language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if not public.has_staff_role('super_admin') then raise exception 'Access denied.'; end if;
  select id into target from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null;
  if target is null then raise exception 'Create and confirm the staff account first.'; end if;
  if target=auth.uid() then raise exception 'A different super administrator must change your role.'; end if;
  if p_role is null then delete from public.user_roles where user_id=target;
  else insert into public.user_roles(user_id,role) values(target,p_role) on conflict(user_id) do update set role=excluded.role;
  end if;
end $$;

create function public.staff_directory() returns table(user_id uuid,email text,full_name text,role public.staff_role)
language sql stable security definer set search_path = '' as $$
  select r.user_id,u.email,p.full_name,r.role from public.user_roles r
  join auth.users u on u.id=r.user_id left join public.profiles p on p.id=r.user_id
  where public.has_staff_role('super_admin');
$$;

create function public.review_identity(p_id uuid,p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_staff_role('super_admin','admin','coordinator') then raise exception 'Access denied.'; end if;
  if p_status not in ('verified','needs_review') then raise exception 'Invalid identity status.'; end if;
  update public.application_identity set verification_status=p_status,
    verified_at=case when p_status='verified' then now() else verified_at end
    where application_id=p_id;
end $$;

create function public.record_enquiry(p_name text,p_email text,p_topic text,p_message text,p_hash text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_hash)::bigint);
  if (select count(*) from public.contact_enquiries where source_hash=p_hash and created_at>now()-interval '1 hour')>=5
    then raise exception 'Too many recent enquiries. Please try later.'; end if;
  insert into public.contact_enquiries(full_name,email,topic,message,source_hash) values(p_name,p_email,p_topic,p_message,p_hash);
end $$;

revoke all on function public.public_offers(), public.submit_application(uuid,jsonb),
  public.review_application(uuid,public.application_status,uuid,text), public.choose_payment(uuid,public.payment_method,text),
  public.begin_checkout(uuid,bigint), public.confirm_flutterwave(text,text,bigint,text),
  public.record_manual_payment(uuid,public.payment_method,bigint,text), public.finance_accounts(),
  public.save_discount(uuid,uuid,text,text,bigint,integer,timestamptz,timestamptz,boolean),
  public.manage_staff(text,public.staff_role), public.staff_directory(), public.review_identity(uuid,text),
  public.record_enquiry(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.public_offers() to anon, authenticated;
grant execute on function public.submit_application(uuid,jsonb),
  public.review_application(uuid,public.application_status,uuid,text), public.choose_payment(uuid,public.payment_method,text),
  public.begin_checkout(uuid,bigint), public.record_manual_payment(uuid,public.payment_method,bigint,text),
  public.finance_accounts(), public.save_discount(uuid,uuid,text,text,bigint,integer,timestamptz,timestamptz,boolean),
  public.manage_staff(text,public.staff_role), public.staff_directory(), public.review_identity(uuid,text) to authenticated;
grant execute on function public.confirm_flutterwave(text,text,bigint,text),
  public.record_enquiry(text,text,text,text,text) to service_role;
