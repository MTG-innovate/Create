-- Little Steps step 2: visits and weekly series.

-- A visits row that belongs to a series must be about one of the series' own
-- dates, so notes can never attach to a week the series does not have.
create function private.check_series_date() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  s public.visit_series;
  diff integer;
begin
  if new.series_id is null then
    return new;
  end if;
  select * into s from public.visit_series where id = new.series_id;
  diff := new.occurrence_date - s.starts_on;
  if diff < 0 or diff % (7 * s.every_weeks) <> 0 or (s.ends_on is not null and new.occurrence_date > s.ends_on) then
    raise exception 'That date is not part of this weekly visit' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.check_series_date from public, anon, authenticated;

create trigger check_series_date before insert or update of series_id, occurrence_date on public.visits
  for each row execute function private.check_series_date();

create index visit_series_family_idx on public.visit_series (family_id);

-- Everyone in the family sees a new or changed visit within seconds. Realtime
-- applies the same row level security as every other read.
do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.visits, public.visit_series;
  end if;
end;
$$;

-- "Stop the weekly visits from here": removes this date and every later one,
-- keeping earlier visits and their notes. All of it happens, or none of it.
-- Runs as the caller, so row level security still decides what they may change.
create function public.stop_series(series uuid, from_date date) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  s public.visit_series;
begin
  select * into s from public.visit_series where id = series;
  if not found then
    raise exception 'That weekly visit could not be found' using errcode = '22023';
  end if;

  delete from public.visits v where v.series_id = series and v.occurrence_date >= from_date;
  if exists (select 1 from public.visits v where v.series_id = series and v.occurrence_date >= from_date) then
    raise exception 'Some of these visits have notes someone else added. Ask a family member to stop the series.'
      using errcode = '42501';
  end if;

  if from_date <= s.starts_on then
    delete from public.visit_series where id = series;
  else
    update public.visit_series
    set ends_on = from_date - 7 * s.every_weeks, end_confirmed_at = now()
    where id = series;
  end if;
  if not found then
    raise exception 'You can see these visits but not change them' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.stop_series from public, anon;
grant execute on function public.stop_series to authenticated;
