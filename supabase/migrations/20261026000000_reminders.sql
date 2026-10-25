-- Little Steps step 8: reminders on each person's phone.
--
-- A person turns reminders on for one family on one phone. The row holds that
-- phone's push address and what they want to hear about. Only that person can
-- see or change it: these are personal settings, not family records, so the
-- owner cannot read other people's phones.
--
-- The app still has no service key. Reminders are sent by a scheduled server
-- job holding one secret (REMINDER_SECRET). The database keeps only its hash
-- and lets that secret do exactly three things: read what reminders need,
-- claim a reminder so it is sent once, and forget phones that are gone.

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth_key text not null check (char_length(auth_key) <= 100),
  visit_evening boolean not null default true,
  visit_soon boolean not null default true,
  night_feed boolean not null default false,
  night_feed_at time not null default '21:00',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (family_id, user_id, endpoint),
  -- The person must belong to the family (and leaves with it).
  foreign key (family_id, user_id) references public.family_members (family_id, user_id) on delete cascade
);

create trigger stamp before insert or update on public.push_devices
  for each row execute function private.stamp_row();
create trigger audit after insert or update or delete on public.push_devices
  for each row execute function private.audit_row();

alter table public.push_devices enable row level security;
-- Visit reminders need the visits area and night feed reminders the diary, so a
-- helper who sees neither has nothing to be reminded about.
create policy "Own phones" on public.push_devices for select to authenticated
  using (user_id = (select auth.uid()) and (private.can_view(family_id, 'visits') or private.can_view(family_id, 'diary')));
create policy "Add own phone" on public.push_devices for insert to authenticated
  with check (user_id = (select auth.uid()) and (private.can_view(family_id, 'visits') or private.can_view(family_id, 'diary')));
create policy "Change own phone" on public.push_devices for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (private.can_view(family_id, 'visits') or private.can_view(family_id, 'diary')));
create policy "Remove own phone" on public.push_devices for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.push_devices from anon, authenticated;
grant select, insert, delete on public.push_devices to authenticated;
grant update (visit_evening, visit_soon, night_feed, night_feed_at, p256dh, auth_key) on public.push_devices to authenticated;

-- The audit trail notes that a phone was added or changed, but never copies its
-- push address or keys.
create or replace function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  hidden text[] := case when tg_table_name = 'push_devices' then array['endpoint', 'p256dh', 'auth_key'] else '{}' end;
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
    case when tg_op <> 'INSERT' then to_jsonb(old) - hidden end,
    case when tg_op <> 'DELETE' then to_jsonb(new) - hidden end
  );
  return null;
end;
$$;

-- Reminders already sent, so each is sent once. Kept for a few days.
create table private.reminders_sent (
  device_id uuid not null references public.push_devices (id) on delete cascade,
  key text not null check (char_length(key) <= 200),
  sent_at timestamptz not null default now(),
  primary key (device_id, key)
);

-- The hash of the reminder sender's secret. The operator adds it once:
--   insert into private.reminder_sender (secret_hash) values (sha256(convert_to('<REMINDER_SECRET>', 'UTF8')));
create table private.reminder_sender (
  secret_hash bytea primary key,
  created_at timestamptz not null default now()
);

create function private.is_reminder_sender(secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.reminder_sender s
    where s.secret_hash = sha256(convert_to(coalesce(secret, ''), 'UTF8'))
  )
$$;
revoke all on function private.is_reminder_sender from public, anon, authenticated;

-- What the sender needs to work out due reminders, for families where someone
-- has reminders on: no push addresses, no notes, nothing about the child but
-- their first name, and only the next two days of visits.
create function public.reminder_data(secret text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_reminder_sender(secret) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', f.id,
      'time_zone', f.time_zone,
      'children', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.created_at), '[]') from public.children c where c.family_id = f.id),
      'devices', (
        select jsonb_agg(jsonb_build_object(
          'id', d.id, 'user_id', d.user_id, 'role', m.role, 'view_areas', m.view_areas, 'edit_areas', m.edit_areas,
          'visit_evening', d.visit_evening, 'visit_soon', d.visit_soon, 'night_feed', d.night_feed,
          'night_feed_at', to_char(d.night_feed_at, 'HH24:MI')))
        from public.push_devices d
        join public.family_members m on m.family_id = d.family_id and m.user_id = d.user_id
        where d.family_id = f.id
      ),
      'series', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', s.id, 'child_id', s.child_id, 'kind', s.kind, 'title', s.title, 'starts_on', s.starts_on,
          'start_time', to_char(s.start_time, 'HH24:MI'), 'every_weeks', s.every_weeks, 'ends_on', s.ends_on)), '[]')
        from public.visit_series s where s.family_id = f.id
      ),
      'visits', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', v.id, 'child_id', v.child_id, 'series_id', v.series_id, 'occurrence_date', v.occurrence_date,
          'kind', v.kind, 'title', v.title, 'date', v.date, 'time', to_char(v.time, 'HH24:MI'), 'cancelled', v.cancelled)), '[]')
        from public.visits v
        where v.family_id = f.id
          and (v.date between (now() at time zone f.time_zone)::date - 1 and (now() at time zone f.time_zone)::date + 2
               or v.occurrence_date between (now() at time zone f.time_zone)::date - 1 and (now() at time zone f.time_zone)::date + 2)
      ),
      'night_feeds', (
        select coalesce(jsonb_agg(jsonb_build_object('child_id', n.child_id, 'date', n.date)), '[]')
        from public.moments n
        where n.family_id = f.id and n.type = 'night_feed'
          and n.date >= (now() at time zone f.time_zone)::date - 1
      )
    ))
    from public.families f
    where exists (select 1 from public.push_devices d where d.family_id = f.id)
  ), '[]'::jsonb);
end;
$$;

-- Claims reminders before sending, so a reminder is sent once even if two
-- senders run. Returns the push address only for reminders newly claimed.
create function public.claim_reminders(secret text, claims jsonb)
returns table (device_id uuid, key text, endpoint text, p256dh text, auth_key text)
language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not private.is_reminder_sender(secret) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  delete from private.reminders_sent r where r.sent_at < now() - interval '4 days';
  return query
    with wanted as (
      select (c ->> 'device_id')::uuid as device_id, c ->> 'key' as key
      from jsonb_array_elements(claims) c
    ), claimed as (
      insert into private.reminders_sent (device_id, key)
      select w.device_id, w.key from wanted w
      where exists (select 1 from public.push_devices d where d.id = w.device_id)
      on conflict do nothing
      returning reminders_sent.device_id, reminders_sent.key
    )
    select c.device_id, c.key, d.endpoint, d.p256dh, d.auth_key
    from claimed c join public.push_devices d on d.id = c.device_id;
end;
$$;

-- Forgets phones whose push service says they are gone.
create function public.forget_push_devices(secret text, ids uuid[]) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.is_reminder_sender(secret) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  -- Not a person's own change, so it is not stamped as theirs; the audit trail
  -- records it with no actor.
  delete from public.push_devices d where d.id = any (ids);
end;
$$;

revoke all on function public.reminder_data, public.claim_reminders, public.forget_push_devices from public;
grant execute on function public.reminder_data, public.claim_reminders, public.forget_push_devices to anon, authenticated;
