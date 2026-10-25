-- Ready for the pilot (build brief step 9): new Care Circles can be limited to
-- families with a pilot code, and anyone in a Care Circle can send feedback to
-- the JOSIA Care team. Both live in the private schema: no one using the app
-- can read the codes or anyone's feedback, not even an owner. The operator
-- reads them in the Supabase dashboard (see docs/PILOT.md).

-- Sign-up is open until the operator turns on invite only. One row, always.
create table private.signup (
  one_row boolean primary key default true check (one_row),
  invite_only boolean not null default false
);
insert into private.signup default values;

-- Only a hash of each code is stored, like invitation tokens.
create table private.pilot_codes (
  code_hash bytea primary key,
  label text not null check (char_length(label) between 1 and 120),
  uses_left integer not null default 1 check (uses_left >= 0),
  created_at timestamptz not null default now()
);

create function private.code_hash(code text) returns bytea
language sql immutable set search_path = '' as $$
  select sha256(convert_to(upper(regexp_replace(code, '\s', '', 'g')), 'UTF8'))
$$;

-- Lets the welcome page ask for a code only when one is needed.
create function public.signup_needs_code() returns boolean
language sql stable security definer set search_path = '' as $$
  select invite_only from private.signup
$$;

-- create_family() gains a pilot code. Everything else is as before.
drop function public.create_family(text, text, date, text);
create function public.create_family(
  family_name text,
  child_name text,
  child_birth_date date default null,
  family_time_zone text default 'America/New_York',
  pilot_code text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  fam uuid;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if (select invite_only from private.signup) then
    update private.pilot_codes set uses_left = uses_left - 1
      where code_hash = private.code_hash(coalesce(pilot_code, '')) and uses_left > 0;
    if not found then
      raise exception 'Please check the pilot code. The person who invited you to the pilot can send it again.'
        using errcode = '22023';
    end if;
  end if;
  insert into public.families (name, time_zone) values (trim(family_name), family_time_zone)
    returning id into fam;
  insert into public.family_members (family_id, user_id, role) values (fam, me, 'owner');
  insert into public.children (family_id, name, birth_date) values (fam, trim(child_name), child_birth_date);
  return fam;
end;
$$;

-- Feedback goes to the JOSIA Care team, not to the Care Circle, so it is not a
-- care record: it is not audited (owners read the audit trail) and is not in
-- the export. It is kept with the family so the team knows where it came from,
-- and leaves with the person or the family.
create table private.feedback (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 2000),
  page text check (char_length(page) <= 200),
  created_at timestamptz not null default now()
);
create index feedback_recent on private.feedback (user_id, created_at);

create function public.send_feedback(family uuid, message text, page text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if not exists (select 1 from public.family_members m where m.family_id = family and m.user_id = me) then
    raise exception 'Only people in this Care Circle can send feedback from it' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(message, ''))) = 0 then
    raise exception 'Please write a few words first.' using errcode = '22023';
  end if;
  if (select count(*) from private.feedback f where f.user_id = me and f.created_at > now() - interval '1 day') >= 20 then
    raise exception 'Thank you for so much feedback today. Please send more tomorrow.' using errcode = '22023';
  end if;
  insert into private.feedback (family_id, user_id, message, page) values (family, me, trim(message), left(page, 200));
end;
$$;

revoke all on function public.create_family, public.signup_needs_code, public.send_feedback from public, anon;
grant execute on function public.create_family, public.signup_needs_code, public.send_feedback to authenticated;
