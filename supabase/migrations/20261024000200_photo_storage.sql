-- Little Steps: private storage for children's photos.
-- Objects live at "<family_id>/<child_id>/<file>". Nothing is public; the app
-- serves photos through signed links that expire.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('child-photos', 'child-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create function private.family_from_path(object_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(object_name, '/', 1)::uuid
  end
$$;
revoke all on function private.family_from_path from public, anon;
grant execute on function private.family_from_path to authenticated;

create policy "Members see their family's photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'child-photos' and private.is_member(private.family_from_path(name)));

create policy "Owners and Family add photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'child-photos' and private.has_role(private.family_from_path(name), '{owner,family}'));

create policy "Owners and Family replace photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'child-photos' and private.has_role(private.family_from_path(name), '{owner,family}'))
  with check (bucket_id = 'child-photos' and private.has_role(private.family_from_path(name), '{owner,family}'));

create policy "Owners and Family remove photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'child-photos' and private.has_role(private.family_from_path(name), '{owner,family}'));
