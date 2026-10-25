-- Little Steps essentials for a NICU graduate's everyday life:
--   1. Corrected age: the baby's due date.
--   2. Medicine times: when each medicine is given, for the "Medicines today"
--      checklist. Ticking a dose adds a "medicine given" diary moment.
--   3. The emergency card: conditions, allergies, the emergency plan and the
--      preferred hospital, kept on the child so everyone in the Care Circle
--      (a sitter included) can see them, and only owners and family change them.
--   4. Pumping: a diary moment kind (added in the next migration file, because
--      a new enum value cannot be used in the transaction that adds it).
--   5. Equipment and supplies: what the baby uses and when to reorder, in the
--      same care area as medicines.
--
-- To undo: supabase/rollbacks/20261028000000_baby_essentials.sql

alter table public.children
  add column due_date date,
  add column conditions text check (char_length(conditions) <= 2000),
  add column allergies text check (char_length(allergies) <= 1000),
  add column emergency_plan text check (char_length(emergency_plan) <= 4000),
  add column hospital text check (char_length(hospital) <= 300),
  add constraint due_date_near_birth check (
    due_date is null or birth_date is null or due_date between birth_date - 30 and birth_date + 140
  );

alter table public.medicines
  add column times time[] not null default '{}' check (cardinality(times) <= 6);

create table public.supplies (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  category text not null default 'Supply' check (category in ('Equipment', 'Supply')),
  details text check (char_length(details) <= 500),
  supplier text check (char_length(supplier) <= 200),
  phone text check (char_length(phone) <= 40),
  reorder_days int check (reorder_days between 1 and 365),
  last_ordered date,
  active boolean not null default true,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade
);
create index supplies_family_idx on public.supplies (family_id, child_id);

create trigger stamp before insert or update on public.supplies
  for each row execute function private.stamp_row();
create trigger audit after insert or update or delete on public.supplies
  for each row execute function private.audit_row();
alter table public.supplies enable row level security;
create policy "View by care area" on public.supplies for select to authenticated using (private.can_view(family_id, 'medicines'));
create policy "Add by care area" on public.supplies for insert to authenticated with check (private.can_edit(family_id, 'medicines'));
create policy "Change by care area" on public.supplies for update to authenticated
  using (private.can_edit(family_id, 'medicines')) with check (private.can_edit(family_id, 'medicines'));
create policy "Delete by care area" on public.supplies for delete to authenticated using (private.can_delete(family_id, 'medicines', created_by));
grant select, insert, update, delete on public.supplies to authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.supplies;
  end if;
end;
$$;
