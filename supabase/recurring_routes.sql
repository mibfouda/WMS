-- WasteOps: recurring routes that run every day on the database itself
-- (no one needs to open the dashboard). Run once in Supabase → SQL Editor.

create extension if not exists pg_cron;

create table if not exists public.recurring_routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  driver_id integer not null references public.drivers(driver_id) on delete cascade,
  bin_ids integer[] not null,          -- containers in stop order
  weekdays integer[] not null,         -- 0=Sun … 6=Sat
  start_date date not null,
  end_date date,                       -- null = forever
  active boolean not null default true,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.recurring_routes to authenticated;
grant all on public.recurring_routes to service_role;
alter table public.recurring_routes enable row level security;

drop policy if exists "supervisors manage recurring routes" on public.recurring_routes;
create policy "supervisors manage recurring routes" on public.recurring_routes
  for all to authenticated using (true) with check (true);

-- Creates the day's tasks for every due route; skips tasks that already exist.
create or replace function public.generate_recurring_tasks(
  p_day date default (now() at time zone 'Asia/Muscat')::date
) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.daily_tasks (driver_id, bin_id, task_date, route_order, status)
  select r.driver_id, s.bin_id, p_day, s.ord::int, 'Pending'
  from public.recurring_routes r
  cross join lateral unnest(r.bin_ids) with ordinality as s(bin_id, ord)
  where r.active
    and p_day >= r.start_date
    and (r.end_date is null or p_day <= r.end_date)
    and extract(dow from p_day)::int = any (r.weekdays)
    and not exists (
      select 1 from public.daily_tasks t
      where t.task_date = p_day and t.driver_id = r.driver_id and t.bin_id = s.bin_id
    );
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.generate_recurring_tasks(date) from public, anon;
grant execute on function public.generate_recurring_tasks(date) to authenticated, service_role;

-- Every day at 00:05 Oman/UAE time (20:05 UTC).
select cron.unschedule('wasteops-recurring')
  where exists (select 1 from cron.job where jobname = 'wasteops-recurring');
select cron.schedule('wasteops-recurring', '5 20 * * *', $$select public.generate_recurring_tasks()$$);
