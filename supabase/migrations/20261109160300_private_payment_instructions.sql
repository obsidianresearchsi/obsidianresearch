create table public.payment_settings (
  singleton boolean primary key default true check (singleton),
  cash_instructions text not null check (char_length(cash_instructions) between 1 and 1000),
  transfer_instructions text not null check (char_length(transfer_instructions) between 1 and 1000),
  updated_at timestamptz not null default now()
);
insert into public.payment_settings(cash_instructions,transfer_instructions)
select coalesce(details->>'cashInstructions','Bring your application reference to the training centre.'),
  coalesce(details->>'transferInstructions','Contact the training centre for verified bank details.')
from public.site_content where kind='company' and slug='profile';
update public.site_content set details=details-'cashInstructions'-'transferInstructions' where kind='company';
alter table public.payment_settings enable row level security;
revoke all on public.payment_settings from public,anon,authenticated;
grant select, update(cash_instructions,transfer_instructions,updated_at) on public.payment_settings to authenticated;
grant all on public.payment_settings to service_role;
create policy payment_settings_read on public.payment_settings for select to authenticated
using (public.has_staff_role('super_admin','admin','finance') or exists(
  select 1 from public.applications a where a.user_id=(select auth.uid())
    and a.status in ('approved','awaiting_payment','payment_confirmed','enrolled')
));
create policy payment_settings_update on public.payment_settings for update to authenticated
using (public.has_staff_role('super_admin','admin','finance'))
with check (public.has_staff_role('super_admin','admin','finance'));
create trigger audit_payment_instructions after update on public.payment_settings
for each row execute function private.audit();
create trigger audit_enrollment_changes after update on public.enrollments
for each row execute function private.audit();

create function public.owns_course_record(p_course uuid,p_batch uuid default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.applications a where a.course_id=p_course
    and a.user_id=(select auth.uid()) and (p_batch is null or a.preferred_batch_id=p_batch))
    or exists(select 1 from public.enrollments e where e.course_id=p_course
    and e.user_id=(select auth.uid()) and (p_batch is null or e.batch_id=p_batch));
$$;
revoke all on function public.owns_course_record(uuid,uuid) from public;
grant execute on function public.owns_course_record(uuid,uuid) to authenticated;
create policy course_participant_read on public.courses for select to authenticated
using (public.owns_course_record(id,null));
create policy batch_participant_read on public.course_batches for select to authenticated
using (public.owns_course_record(course_id,id));
