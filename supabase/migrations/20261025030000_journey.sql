-- Little Steps step 4: the journey. Wins already exist (care_records); this
-- lets the whole family see a new win or bright spot within seconds, and
-- keeps the growth chart's weigh-in lookup fast.
do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.wins;
  end if;
end;
$$;

create index wins_family_child_idx on public.wins (family_id, child_id, happened_on desc);
