-- Little Steps step 3: the diary. Moments already exist (care_records); this
-- lets everyone in the family see new ones within seconds.
do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.moments;
  end if;
end;
$$;

create index moments_family_type_idx on public.moments (family_id, child_id, type, date desc, time desc);
