-- Undoes supabase/migrations/20261027000000_care_journeys.sql. Only for a
-- deliberate rollback by the operator: it forgets which journey each person
-- follows. tests/db/journeys.test.ts runs it to prove it works.

alter table public.children drop column journey;
drop type public.care_journey;
