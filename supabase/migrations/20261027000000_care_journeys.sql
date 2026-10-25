-- JOSIA Care, first milestone: every person receiving care follows one care
-- journey. Little Steps (NICU graduates and medically complex little ones) is
-- the only journey so far; Everyday Progress and Care Together come later.
--
-- Everyone already in the app is in Little Steps, so nothing changes for
-- them. The table keeps its name, "children", for now: the app calls them the
-- person receiving care as the other journeys arrive.
--
-- To undo: supabase/rollbacks/20261027000000_care_journeys.sql

create type public.care_journey as enum ('little_steps', 'everyday_progress', 'care_together');

alter table public.children
  add column journey public.care_journey not null default 'little_steps';
