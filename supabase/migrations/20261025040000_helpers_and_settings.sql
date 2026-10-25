-- Little Steps step 5: helpers, practice at home, medicines, settings and photo.

-- A child's photo can only ever point inside that child's own folder, so no
-- record can name a file that belongs to another family.
alter table public.children
  add constraint photo_in_own_folder
  check (photo_path is null or photo_path like family_id::text || '/' || id::text || '/%');

-- One check per practice item per day was already enforced; who checked it is
-- created_by. Everyone in the family sees changes to these within seconds.
do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.practice_items, public.practice_checks, public.team_contacts, public.medicines, public.children, public.families;
  end if;
end;
$$;
