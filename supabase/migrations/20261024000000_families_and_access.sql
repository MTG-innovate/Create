-- Little Steps: families, the people in them, invitations, and the access rules
-- that every other table builds on.
--
-- Isolation model
--   * Every record belongs to exactly one family (family_id).
--   * A signed-in person sees a family's records only through a row in
--     family_members. Row level security enforces this in the database.
--   * Owners and Family see and change everything. Viewers see everything and
--     change nothing. Helpers see and change only the care areas the owner
--     chose for them when inviting them.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.family_role as enum ('owner', 'family', 'helper', 'viewer');

-- The parts of the app a helper can be given. "view" and "edit" are granted
-- separately per helper.
create type public.care_area as enum (
  'visits',      -- visits and weekly series
  'diary',       -- meals, night feeds, diapers, naps, playtime, medicine given, notes
  'nurse_notes', -- nurse notes
  'growth',      -- weigh ins
  'practice',    -- practice at home and the daily checklist
  'medicines',   -- the medicine list
  'team',        -- helpers' names and phone numbers
  'wins',        -- wins and bright spots
  'questions'    -- questions to ask
);

create function private.is_valid_time_zone(tz text) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz)
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  feed_unit text not null default 'oz' check (feed_unit in ('oz', 'ml')),
  encouragement text not null default 'scripture' check (encouragement in ('scripture', 'gentle')),
  time_zone text not null default 'America/New_York' check (private.is_valid_time_zone(time_zone)),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.family_role not null,
  helper_label text check (char_length(helper_label) <= 60),
  view_areas public.care_area[] not null default '{}',
  edit_areas public.care_area[] not null default '{}',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (family_id, user_id),
  constraint edit_needs_view check (edit_areas <@ view_areas),
  constraint areas_only_for_helpers check (role = 'helper' or (view_areas = '{}' and edit_areas = '{}'))
);
create index family_members_user_idx on public.family_members (user_id);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  birth_date date,
  photo_path text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  -- Lets records point at (child_id, family_id) so a record can never name a
  -- child from another family.
  unique (id, family_id)
);
create index children_family_idx on public.children (family_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+$'),
  role public.family_role not null,
  helper_label text check (char_length(helper_label) <= 60),
  view_areas public.care_area[] not null default '{}',
  edit_areas public.care_area[] not null default '{}',
  -- Only a SHA-256 hash of the link token is stored. The token itself is shown
  -- to the inviting owner once and is never readable again.
  token_hash bytea not null unique,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  constraint edit_needs_view check (edit_areas <@ view_areas),
  constraint areas_only_for_helpers check (role = 'helper' or (view_areas = '{}' and edit_areas = '{}')),
  constraint helpers_see_something check (role <> 'helper' or view_areas <> '{}')
);
create index invitations_family_idx on public.invitations (family_id);

-- Who added, changed or deleted each record. Written only by triggers.
create table public.audit_log (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete', 'purge')),
  actor uuid,
  at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);
create index audit_log_family_idx on public.audit_log (family_id, at desc);
create index audit_log_child_idx on public.audit_log (child_id);

-- ---------------------------------------------------------------------------
-- Access checks used by every policy. SECURITY DEFINER so they can read
-- family_members without recursing through its own policies.
-- ---------------------------------------------------------------------------

create function private.my_role(fam uuid) returns public.family_role
language sql stable security definer set search_path = '' as $$
  select m.role from public.family_members m
  where m.family_id = fam and m.user_id = (select auth.uid())
$$;

create function private.is_member(fam uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members m
    where m.family_id = fam and m.user_id = (select auth.uid())
  )
$$;

create function private.has_role(fam uuid, roles public.family_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members m
    where m.family_id = fam and m.user_id = (select auth.uid()) and m.role = any (roles)
  )
$$;

create function private.can_view(fam uuid, area public.care_area) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members m
    where m.family_id = fam and m.user_id = (select auth.uid())
      and (m.role <> 'helper' or area = any (m.view_areas))
  )
$$;

create function private.can_edit(fam uuid, area public.care_area) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members m
    where m.family_id = fam and m.user_id = (select auth.uid())
      and (m.role in ('owner', 'family') or (m.role = 'helper' and area = any (m.edit_areas)))
  )
$$;

-- Owners and Family can delete any record. Helpers can delete only records
-- they added themselves, in areas they can edit.
create function private.can_delete(fam uuid, area public.care_area, author uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members m
    where m.family_id = fam and m.user_id = (select auth.uid())
      and (m.role in ('owner', 'family')
           or (m.role = 'helper' and area = any (m.edit_areas) and author = (select auth.uid())))
  )
$$;

create function private.shares_family(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members a
    join public.family_members b on b.family_id = a.family_id
    where a.user_id = (select auth.uid()) and b.user_id = other
  )
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Stamps who and when on every write, and keeps a record in its family:
-- family_id can never change, so a person in two families cannot move a
-- record from one to the other.
create function private.stamp_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := coalesce((select auth.uid()), new.created_by);
  else
    if tg_table_name <> 'families' then
      if new.family_id is distinct from old.family_id then
        raise exception 'A record cannot move to another family' using errcode = '42501';
      end if;
    end if;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  -- While a child's data is being purged, nothing about it is copied here.
  if coalesce(current_setting('little_steps.purging_child', true), '') <> '' then
    return null;
  end if;
  insert into public.audit_log (family_id, child_id, table_name, record_id, action, actor, old_data, new_data)
  values (
    case when tg_table_name = 'families' then (rec ->> 'id')::uuid else (rec ->> 'family_id')::uuid end,
    case when tg_table_name = 'children' then (rec ->> 'id')::uuid else (rec ->> 'child_id')::uuid end,
    tg_table_name,
    coalesce((rec ->> 'id')::uuid, (rec ->> 'user_id')::uuid),
    lower(tg_op),
    (select auth.uid()),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end;
$$;

-- A family always keeps at least one owner. (Skipped when the whole family is
-- being deleted.)
create function private.keep_an_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.families f where f.id = old.family_id)
     and not exists (
       select 1 from public.family_members m
       where m.family_id = old.family_id and m.role = 'owner' and m.user_id <> old.user_id
     )
  then
    raise exception 'A family always needs at least one owner' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Role, areas and label are the only things that can change on a membership.
create function private.lock_membership_keys() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.family_id <> old.family_id or new.user_id <> old.user_id then
    raise exception 'A membership cannot move' using errcode = '42501';
  end if;
  if new.role <> 'helper' then
    new.view_areas := '{}';
    new.edit_areas := '{}';
  end if;
  return new;
end;
$$;

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'display_name', 80), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create trigger stamp before insert or update on public.families
  for each row execute function private.stamp_row();
create trigger stamp before insert or update on public.children
  for each row execute function private.stamp_row();

create trigger audit after insert or update or delete on public.families
  for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.children
  for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.family_members
  for each row execute function private.audit_row();

create trigger keep_an_owner before update or delete on public.family_members
  for each row execute function private.keep_an_owner();
create trigger lock_keys before update on public.family_members
  for each row execute function private.lock_membership_keys();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.children enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_log enable row level security;

create policy "See yourself and people in your families" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_family(id));
create policy "Update your own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Families are created only through create_family().
create policy "Members see their family" on public.families
  for select to authenticated using (private.is_member(id));
create policy "Owners and Family change settings" on public.families
  for update to authenticated
  using (private.has_role(id, '{owner,family}')) with check (private.has_role(id, '{owner,family}'));

-- Memberships are created only through create_family() and accept_invitation().
create policy "Members see who is in their family" on public.family_members
  for select to authenticated using (private.is_member(family_id));
create policy "Owners change roles and areas" on public.family_members
  for update to authenticated
  using (private.has_role(family_id, '{owner}')) with check (private.has_role(family_id, '{owner}'));
create policy "Owners remove people, anyone can leave" on public.family_members
  for delete to authenticated
  using (private.has_role(family_id, '{owner}') or user_id = (select auth.uid()));

-- Children are deleted only through delete_child(), which also purges their
-- records and audit history.
create policy "Members see the children" on public.children
  for select to authenticated using (private.is_member(family_id));
create policy "Owners and Family add children" on public.children
  for insert to authenticated with check (private.has_role(family_id, '{owner,family}'));
create policy "Owners and Family update children" on public.children
  for update to authenticated
  using (private.has_role(family_id, '{owner,family}')) with check (private.has_role(family_id, '{owner,family}'));

-- Invitations are written only through the functions below.
create policy "Owners see invitations" on public.invitations
  for select to authenticated using (private.has_role(family_id, '{owner}'));

create policy "Owners read the audit trail" on public.audit_log
  for select to authenticated using (private.has_role(family_id, '{owner}'));

-- ---------------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------------

create function public.create_family(
  family_name text,
  child_name text,
  child_birth_date date default null,
  family_time_zone text default 'America/New_York'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  fam uuid;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  insert into public.families (name, time_zone) values (trim(family_name), family_time_zone)
    returning id into fam;
  insert into public.family_members (family_id, user_id, role) values (fam, me, 'owner');
  insert into public.children (family_id, name, birth_date) values (fam, trim(child_name), child_birth_date);
  return fam;
end;
$$;

create function public.create_invitation(
  family uuid,
  invitee_email text,
  invitee_role public.family_role,
  helper_label text default null,
  view_areas public.care_area[] default '{}',
  edit_areas public.care_area[] default '{}'
) returns table (invitation_id uuid, token text)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  addr text := lower(trim(invitee_email));
  tok text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  inv uuid;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if not private.has_role(family, '{owner}') then
    raise exception 'Only an owner can invite people' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.family_members m join auth.users u on u.id = m.user_id
    where m.family_id = family and lower(u.email) = addr
  ) then
    raise exception 'That person is already in this family' using errcode = '23505';
  end if;

  -- A new invitation replaces any earlier one still waiting for this address.
  update public.invitations i set revoked_at = now()
  where i.family_id = family and i.email = addr and i.accepted_at is null and i.revoked_at is null;

  insert into public.invitations (family_id, email, role, helper_label, view_areas, edit_areas, token_hash, created_by)
  values (
    family, addr, invitee_role,
    case when invitee_role = 'helper' then nullif(trim(helper_label), '') end,
    case when invitee_role = 'helper' then coalesce(view_areas, '{}') else '{}' end,
    case when invitee_role = 'helper' then coalesce(edit_areas, '{}') else '{}' end,
    sha256(convert_to(tok, 'UTF8')),
    me
  )
  returning id into inv;

  return query select inv, tok;
end;
$$;

create function public.accept_invitation(invitation_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  my_email text;
  inv public.invitations;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  select lower(u.email) into my_email from auth.users u where u.id = me;

  select * into inv from public.invitations i
  where i.token_hash = sha256(convert_to(coalesce(invitation_token, ''), 'UTF8'))
  for update;

  if found and inv.accepted_by = me then
    return inv.family_id; -- already accepted by this person, e.g. a double tap
  end if;
  if not found or inv.accepted_at is not null or inv.revoked_at is not null or inv.expires_at < now() then
    raise exception 'This invitation link is no longer valid' using errcode = '22023';
  end if;
  if inv.email <> my_email then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;

  insert into public.family_members (family_id, user_id, role, helper_label, view_areas, edit_areas, invited_by)
  values (inv.family_id, me, inv.role, inv.helper_label, inv.view_areas, inv.edit_areas, inv.created_by)
  on conflict (family_id, user_id) do nothing;

  update public.invitations set accepted_at = now(), accepted_by = me where id = inv.id;
  return inv.family_id;
end;
$$;

-- What an invitation link is for, so the invite page can say "Join Josiah's
-- family". Says nothing unless the link is still valid, and names the family
-- only to the person it was sent to.
create function public.invitation_preview(invitation_token text)
returns table (family_name text, child_names text[], role public.family_role, helper_label text, for_this_email boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  inv public.invitations;
  mine boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  select * into inv from public.invitations i
  where i.token_hash = sha256(convert_to(coalesce(invitation_token, ''), 'UTF8'))
    and i.revoked_at is null and i.expires_at >= now()
    and (i.accepted_at is null or i.accepted_by = (select auth.uid()));
  if not found then
    return;
  end if;
  select lower(u.email) = inv.email into mine from auth.users u where u.id = (select auth.uid());
  if not mine then
    return query select null::text, null::text[], null::public.family_role, null::text, false;
    return;
  end if;
  return query
    select f.name, array(select c.name from public.children c where c.family_id = f.id order by c.created_at),
           inv.role, inv.helper_label, true
    from public.families f where f.id = inv.family_id;
end;
$$;

create function public.revoke_invitation(invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.invitations i set revoked_at = now()
  where i.id = invitation and i.accepted_at is null and i.revoked_at is null
    and private.has_role(i.family_id, '{owner}');
  if not found then
    raise exception 'That invitation cannot be cancelled' using errcode = '42501';
  end if;
end;
$$;

-- Permanently deletes a child and every record about them, including the
-- audit history of those records. Leaves one audit entry saying a purge
-- happened, with no health data in it.
create function public.delete_child(child uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  fam uuid;
begin
  select c.family_id into fam from public.children c where c.id = child;
  if fam is null or not private.has_role(fam, '{owner}') then
    raise exception 'Only an owner can delete a child''s data' using errcode = '42501';
  end if;

  perform set_config('little_steps.purging_child', child::text, true);
  delete from public.children where id = child; -- cascades to every record about this child
  delete from public.audit_log where child_id = child;
  perform set_config('little_steps.purging_child', '', true);

  insert into public.audit_log (family_id, child_id, table_name, record_id, action, actor)
  values (fam, null, 'children', child, 'purge', (select auth.uid()));
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges. Nothing is open to signed-out visitors.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all functions in schema private from public, anon;
revoke all on function public.create_family, public.create_invitation, public.accept_invitation,
  public.invitation_preview, public.revoke_invitation, public.delete_child from public, anon;

grant execute on all functions in schema private to authenticated;
grant execute on function public.create_family, public.create_invitation, public.accept_invitation,
  public.invitation_preview, public.revoke_invitation, public.delete_child to authenticated;

grant select, update on public.profiles to authenticated;
grant select, update on public.families to authenticated;
grant select, update, delete on public.family_members to authenticated;
grant select, insert, update on public.children to authenticated;
grant select on public.invitations to authenticated;
grant select on public.audit_log to authenticated;
