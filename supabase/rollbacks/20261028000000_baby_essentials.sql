-- Undoes supabase/migrations/20261028000000_baby_essentials.sql. Only for a
-- deliberate rollback by the operator: it removes due dates, emergency card
-- details, medicine times and every equipment and supply record. Pumping
-- moments stay (Postgres cannot remove an enum value); delete them first if
-- needed. tests/db/essentials.test.ts runs this to prove it works.

drop table public.supplies;
alter table public.medicines drop column times;
alter table public.children
  drop constraint due_date_near_birth,
  drop column due_date,
  drop column conditions,
  drop column allergies,
  drop column emergency_plan,
  drop column hospital;
