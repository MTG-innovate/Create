-- Little Steps step 6: questions to ask appear for the whole family within seconds.
do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.questions;
  end if;
end;
$$;
