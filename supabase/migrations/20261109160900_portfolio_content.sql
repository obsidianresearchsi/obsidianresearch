alter table public.site_content drop constraint site_content_kind_check;
alter table public.site_content add constraint site_content_kind_check
  check (kind in ('company','service','announcement','testimonial','faq','promotion','article','portfolio'));
