-- Demo family for local development only (`supabase start` / `supabase db reset`).
-- Josiah's name is used with permission; everything else here is invented.
-- Sign in at http://127.0.0.1:3000 with one of these addresses and open the
-- link from the local mail viewer at http://127.0.0.1:54324.
--   parent@example.com   Owner
--   grandma@example.com  Family
--   nurse@example.com    Helper (Home nurse)

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '', now(),
  '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', u.name), now(), now(), '', '', '', ''
from (values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'parent@example.com', 'Josiah''s parent'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'grandma@example.com', 'Grandma'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'nurse@example.com', 'Nurse Pat')
) as u (id, email, name);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
from auth.users u
where u.email in ('parent@example.com', 'grandma@example.com', 'nurse@example.com');

insert into public.families (id, name, time_zone, created_by)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Josiah''s family', 'America/New_York', '11111111-1111-4111-8111-111111111111');

insert into public.children (family_id, name, birth_date, created_by)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Josiah', '2025-04-12', '11111111-1111-4111-8111-111111111111');

insert into public.family_members (family_id, user_id, role, helper_label, view_areas, edit_areas) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'owner', null, '{}', '{}'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'family', null, '{}', '{}'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'helper', 'Home nurse',
   '{visits,diary,nurse_notes,growth,practice,medicines,team}', '{diary,nurse_notes,growth,practice}');
