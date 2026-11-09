update public.site_content
set title = 'Solar Inverter & Backup Power',
    summary = 'Plan your inverter, battery and panels, then share a budget estimate for review.',
    body = 'Use the solar inverter planner to estimate your appliance load and compare lithium or tubular batteries. Share the estimate with our team to confirm equipment, site requirements and installation pricing.',
    updated_at = now()
where kind = 'service' and slug = 'solar-power' and title = 'Solar & Backup Power'
  and summary = 'Request a quote for solar or backup power.'
  and body = 'Tell us where you need power, what equipment you want to run, and how long you need backup. The team can review your requirements and discuss the next steps.';

update public.site_content
set summary = replace(replace(summary, 'your application in the student portal', 'your application in your Obsidian Workspace'),
    'Create a student account,', 'Create an Obsidian account,'),
    updated_at = now()
where (kind, slug) in (('announcement', 'academy-registration'), ('faq', 'how-to-apply'))
  and (summary like '%your application in the student portal%' or summary like '%Create a student account,%');
