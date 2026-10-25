-- Supabase gives anon and authenticated ALL rights on every new table in
-- public, including TRUNCATE, which ignores row level security. Row level
-- security already stops reads and writes across families, but signed-in
-- people should hold only the rights each table needs, and nothing more.

-- From now on, new tables, sequences and functions start with no rights for
-- these roles; each migration grants what it needs.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, update on public.families to authenticated;
grant select, update, delete on public.family_members to authenticated;
grant select, insert, update on public.children to authenticated;
grant select on public.invitations to authenticated;
grant select on public.audit_log to authenticated;

grant select, insert, update, delete on
  public.visit_series, public.visits, public.moments, public.practice_items, public.practice_checks,
  public.medicines, public.team_contacts, public.wins, public.questions
to authenticated;
