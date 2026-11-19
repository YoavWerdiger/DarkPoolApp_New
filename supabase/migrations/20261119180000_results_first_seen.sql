-- Measure how fast results arrive: the moment the result was first written
-- (earnings: EPS/revenue; economic: actual). Compare to the scheduled time
-- to find where the delay comes from (provider vs. our sync).

alter table public.earnings_calendar
  add column if not exists results_first_seen_at timestamptz;
alter table public.economic_events
  add column if not exists actual_first_seen_at timestamptz;

create or replace function public.earnings_mark_results_first_seen()
returns trigger
language plpgsql
as $$
begin
  if new.results_first_seen_at is null
     and (new.actual is not null or new.revenue_actual is not null) then
    new.results_first_seen_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists earnings_mark_results_first_seen on public.earnings_calendar;
create trigger earnings_mark_results_first_seen
  before insert or update of actual, revenue_actual on public.earnings_calendar
  for each row execute function public.earnings_mark_results_first_seen();

create or replace function public.economic_mark_actual_first_seen()
returns trigger
language plpgsql
as $$
begin
  if new.actual_first_seen_at is null and coalesce(new.actual, '') <> '' then
    new.actual_first_seen_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists economic_mark_actual_first_seen on public.economic_events;
create trigger economic_mark_actual_first_seen
  before insert or update of actual on public.economic_events
  for each row execute function public.economic_mark_actual_first_seen();
