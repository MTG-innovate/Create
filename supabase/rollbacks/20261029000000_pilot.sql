-- Undoes supabase/migrations/20261029000000_pilot.sql. Only for a deliberate
-- rollback by the operator: it removes pilot codes and every feedback message,
-- and sign-up becomes open again. tests/db/pilot.test.ts runs this to prove it
-- works.

drop function public.send_feedback(uuid, text, text);
drop table private.feedback;
drop function public.create_family(text, text, date, text, text);
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
revoke all on function public.create_family from public, anon;
grant execute on function public.create_family to authenticated;
drop function public.signup_needs_code();
drop function private.code_hash(text);
drop table private.pilot_codes;
drop table private.signup;
