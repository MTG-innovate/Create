@AGENTS.md
@README.md

## Working on Little Steps

- Read `docs/BUILD_BRIEF.pdf` and `docs/little-steps-prototype.html` before building a feature. Copy words and behavior from the prototype.
- Use the child's name in copy, not pronouns ("How Josiah ate", "Josiah's helpers"). Refer to nurses and helpers neutrally.
- Every new table gets `family_id`, the `stamp` and `audit` triggers, RLS policies through `private.can_view / can_edit / can_delete` with a care area, and a row in `tests/db/helpers.ts` `sampleRows` so the separation tests cover it.
- Change the database only with a new file in `supabase/migrations`. Never edit one that has been pushed.
- Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db:local` before pushing.
