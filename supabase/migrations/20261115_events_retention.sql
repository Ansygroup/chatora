-- Retention for anonymous analytics rows.
-- public.events holds consented pageview / lead_submitted counters only.
-- Rows older than 90 days are deleted every night (03:17 UTC) by pg_cron.
-- legal.html states this period: change both together.

create extension if not exists pg_cron;

create or replace function public.chatora_purge_old_events()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.events
    where created_at < now() - interval '90 days'
    returning 1
  )
  select count(*)::integer from gone;
$$;

revoke all on function public.chatora_purge_old_events() from public, anon, authenticated;
grant execute on function public.chatora_purge_old_events() to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'chatora-events-retention';
select cron.schedule(
  'chatora-events-retention',
  '17 3 * * *',
  $job$select public.chatora_purge_old_events()$job$
);
