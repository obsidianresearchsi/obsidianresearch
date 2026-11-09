alter table public.discounts add column coupon_code text
  check (coupon_code is null or (coupon_code ~ '^[A-Z0-9][A-Z0-9-]{2,31}$'
    and ends_at is not null and claim_limit is not null));
drop index public.discounts_one_active;
create unique index discounts_one_active on public.discounts(course_id) where active and coupon_code is null;
create unique index discounts_course_coupon on public.discounts(course_id,coupon_code) where coupon_code is not null;
create index applications_coupon_user on public.applications(discount_id,user_id) where discount_kobo>0;

update public.discounts d set claim_limit=greatest(20,d.claimed)
from public.courses c where c.id=d.course_id and c.slug in ('networking-infrastructure','forex-financial-markets')
  and d.label='Early bird registration' and d.kind='percent' and d.value=20 and d.claim_limit=5;

drop function public.save_discount(uuid,uuid,text,text,bigint,integer,timestamptz,timestamptz,boolean);

create or replace function public.public_offers() returns table
  (course_id uuid, label text, kind text, value bigint, claim_limit integer, remaining integer, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.course_id,d.label,d.kind,d.value,d.claim_limit,
    case when d.claim_limit is null then null else d.claim_limit-d.claimed end,d.ends_at
  from public.discounts d join public.courses c on c.id=d.course_id
  where c.published and not c.archived and c.registrations_open and c.phase in ('upcoming','starting_soon')
    and (c.capacity is null or c.reserved_count < c.capacity)
    and (c.registration_deadline is null or c.registration_deadline > now())
    and d.coupon_code is null and d.active and (d.claim_limit is null or d.claimed < d.claim_limit)
    and (d.starts_at is null or d.starts_at <= now()) and (d.ends_at is null or d.ends_at > now());
$$;

create or replace function public.submit_application(p_course uuid, p_data jsonb)
returns table(id uuid, reference text, payable_kobo bigint)
language plpgsql security definer set search_path = '' as $$
declare
  applicant uuid := auth.uid(); confirmed_email text;
  c public.courses; promo public.discounts; a public.applications;
  batch uuid := nullif(p_data->>'preferred_batch_id','')::uuid;
  photo text := nullif(p_data->>'photo_path','');
  nin text := nullif(p_data->>'nin_ciphertext','');
  saving bigint := 0;
  code text := nullif(upper(btrim(p_data->>'coupon_code')),'');
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
    and d.coupon_code is not distinct from code
    and not exists(select 1 from public.applications used
      where used.user_id=applicant and used.discount_id=d.id and used.discount_kobo>0)
    and (d.starts_at is null or d.starts_at<=now()) and (d.ends_at is null or d.ends_at>now())
    and (d.claim_limit is null or d.claimed<d.claim_limit) for update;
  if found then
    saving := least(c.fee_kobo,case when promo.kind='percent' then c.fee_kobo*promo.value/100 else promo.value end);
    if saving>0 then update public.discounts set claimed=claimed+1 where discounts.id=promo.id; end if;
  end if;
  if code is not null and saving=0 then
    raise exception 'This coupon is invalid, expired, or has reached its usage limit.';
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

create function public.save_discount(p_course uuid,p_id uuid,p_label text,p_kind text,p_value bigint,
  p_limit integer,p_start timestamptz,p_end timestamptz,p_active boolean,p_code text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
  code text := nullif(upper(btrim(p_code)),'');
begin
  if code is not null and (code !~ '^[A-Z0-9][A-Z0-9-]{2,31}$' or p_end is null or p_limit is null) then
    raise exception 'Enter a valid coupon code, expiry, and usage limit.';
  end if;
  if not public.has_staff_role('super_admin','admin','coordinator') then raise exception 'Access denied.'; end if;
  perform 1 from public.courses where id=p_course for update;
  if not found then raise exception 'Course not found.'; end if;
  if p_active and code is null then update public.discounts set active=false where course_id=p_course and active and coupon_code is null and id is distinct from p_id; end if;
  if p_id is not null and exists(select 1 from public.discounts
    where id=p_id and course_id=p_course and (coupon_code is distinct from code and claimed>0
      or p_limit is not null and p_limit<claimed)) then
    raise exception 'Keep the original code after redemption and set the limit at or above the number used.';
  end if;
  if p_id is null then
    insert into public.discounts(course_id,label,kind,value,claim_limit,starts_at,ends_at,active,coupon_code)
      values(p_course,p_label,p_kind,p_value,p_limit,p_start,p_end,p_active,code) returning id into result;
  else
    update public.discounts set label=p_label,kind=p_kind,value=p_value,claim_limit=p_limit,starts_at=p_start,
      ends_at=p_end,active=p_active,coupon_code=code where id=p_id and course_id=p_course returning id into result;
  end if;
  if result is null then raise exception 'Discount not found.'; end if;
  return result;
end $$;

create function public.quote_registration_coupon(p_course uuid,p_code text)
returns table(discount_kobo bigint,payable_kobo bigint)
language sql stable security definer set search_path = '' as $$
  select price.saving, c.fee_kobo-price.saving
  from public.discounts d join public.courses c on c.id=d.course_id
  cross join lateral (select least(c.fee_kobo,case when d.kind='percent' then c.fee_kobo*d.value/100 else d.value end) saving) price
  where auth.uid() is not null and c.id=p_course and d.coupon_code=upper(btrim(p_code))
    and c.published and not c.archived and c.registrations_open and c.phase in ('upcoming','starting_soon')
    and (c.registration_deadline is null or c.registration_deadline>now())
    and (c.capacity is null or c.reserved_count<c.capacity)
    and d.active and d.claimed<d.claim_limit and price.saving>0
    and (d.starts_at is null or d.starts_at<=now()) and d.ends_at>now()
    and not exists(select 1 from public.applications a
      where a.user_id=auth.uid() and a.discount_id=d.id and a.discount_kobo>0);
$$;

revoke all on function public.quote_registration_coupon(uuid,text),
  public.save_discount(uuid,uuid,text,text,bigint,integer,timestamptz,timestamptz,boolean,text)
  from public,anon,authenticated;
grant execute on function public.quote_registration_coupon(uuid,text),
  public.save_discount(uuid,uuid,text,text,bigint,integer,timestamptz,timestamptz,boolean,text) to authenticated;
