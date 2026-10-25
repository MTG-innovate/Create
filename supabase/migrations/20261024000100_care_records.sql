-- Little Steps: the care records. Each one belongs to a family and, except for
-- the helper contact list, to one child in that family. The composite foreign
-- keys to children (id, family_id) make it impossible for a record to name a
-- child from a different family.
--
-- Screens for these arrive in later build steps; the tables, their security and
-- their audit trail are all in place now.

create domain public.visit_kind as text check (value in (
  'Primary care', 'Cardiology', 'GI', 'Advanced feeding', 'Ophthalmology', 'Other specialist',
  'Physical therapy', 'Occupational therapy', 'Speech therapy', 'In-home nurse', 'Lab or test', 'Other'
));

create type public.moment_type as enum (
  'meal', 'night_feed', 'diaper', 'nap', 'playtime', 'medicine_given', 'weigh_in', 'nurse_note', 'note'
);

-- Weekly repeating visits. Each date in the series is worked out from this
-- rule. A row in visits exists for a date only when someone adds notes to it,
-- changes it or cancels it.
create table public.visit_series (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null,
  kind public.visit_kind not null,
  title text,
  provider text,
  location text,
  who text,
  bring text,
  notes text,
  starts_on date not null,
  start_time time,
  every_weeks smallint not null default 1 check (every_weeks between 1 and 4),
  ends_on date check (ends_on >= starts_on),
  -- Set when the family answers "It is ending" to the keep-it-going prompt.
  end_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade,
  unique (id, child_id, family_id)
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null,
  series_id uuid,
  occurrence_date date, -- for series visits: which date in the series this row is about
  kind public.visit_kind not null,
  title text,
  provider text,
  date date not null,
  time time,
  location text,
  who text,
  bring text,
  notes text,     -- before the visit
  summary text,   -- what happened at the visit
  homework text,  -- what to do at home
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade,
  foreign key (series_id, child_id, family_id) references public.visit_series (id, child_id, family_id) on delete cascade,
  unique (series_id, occurrence_date),
  check ((series_id is null) = (occurrence_date is null))
);
create index visits_family_date_idx on public.visits (family_id, date);

-- Everything logged in the diary. Fields that only some types have (amount,
-- pump rate, pounds and ounces, and so on) live in details, checked by the app.
create table public.moments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null,
  type public.moment_type not null,
  date date not null, -- for a night feed, the night it started
  time time,
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object'),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade
);
create index moments_family_date_idx on public.moments (family_id, date);

create table public.practice_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null,
  instruction text not null,
  provider text,
  frequency text check (frequency in ('Every day', 'Several times a day', 'A few times a week', 'Weekly', 'As needed')),
  since date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade,
  unique (id, child_id, family_id)
);

-- One row per practice item per day it was done. created_by is who checked it.
create table public.practice_checks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null,
  practice_item_id uuid not null,
  done_on date not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  foreign key (practice_item_id, child_id, family_id) references public.practice_items (id, child_id, family_id) on delete cascade,
  unique (practice_item_id, done_on)
);

create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null,
  name text not null,
  dose text,
  when_to_give text,
  prescriber text,
  pharmacy text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade
);

-- The family's care team. Shared by all children in the family.
create table public.team_contacts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null,
  role text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table public.wins (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null,
  title text not null,
  happened_on date not null,
  category text not null default 'Bright spot' check (category in (
    'A first', 'Bright spot', 'Feeding', 'Growing', 'Moving', 'Sounds and talking', 'Health', 'Just because'
  )),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null,
  text text not null,
  for_whom text,
  done boolean not null default false,
  answer text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  foreign key (child_id, family_id) references public.children (id, family_id) on delete cascade
);

-- Which care area each kind of moment belongs to, for helper access.
-- Medicine given is part of the diary (a nurse logging a dose should not need
-- permission to change the medicine list).
create function private.moment_area(t public.moment_type) returns public.care_area
language sql immutable set search_path = '' as $$
  select case t
    when 'nurse_note' then 'nurse_notes'::public.care_area
    when 'weigh_in' then 'growth'::public.care_area
    else 'diary'::public.care_area
  end
$$;
revoke all on function private.moment_area from public, anon;
grant execute on function private.moment_area to authenticated;

-- Same triggers and policy shape on every care table; only the area differs.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('visit_series', $a$'visits'$a$),
      ('visits', $a$'visits'$a$),
      ('moments', 'private.moment_area(type)'),
      ('practice_items', $a$'practice'$a$),
      ('practice_checks', $a$'practice'$a$),
      ('medicines', $a$'medicines'$a$),
      ('team_contacts', $a$'team'$a$),
      ('wins', $a$'wins'$a$),
      ('questions', $a$'questions'$a$)
    ) as v (tbl, area)
  loop
    execute format('create trigger stamp before insert or update on public.%I for each row execute function private.stamp_row()', t.tbl);
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function private.audit_row()', t.tbl);
    execute format('alter table public.%I enable row level security', t.tbl);
    execute format('create policy "View by care area" on public.%I for select to authenticated using (private.can_view(family_id, %s))', t.tbl, t.area);
    execute format('create policy "Add by care area" on public.%I for insert to authenticated with check (private.can_edit(family_id, %s))', t.tbl, t.area);
    execute format('create policy "Change by care area" on public.%I for update to authenticated using (private.can_edit(family_id, %s)) with check (private.can_edit(family_id, %s))', t.tbl, t.area, t.area);
    execute format('create policy "Delete by care area" on public.%I for delete to authenticated using (private.can_delete(family_id, %s, created_by))', t.tbl, t.area);
    execute format('revoke all on public.%I from anon', t.tbl);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t.tbl);
  end loop;
end;
$$;
