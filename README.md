# Little Steps

One warm, shared place for families caring for a baby or toddler who came home
from the NICU. See `docs/BUILD_BRIEF.pdf` for the product and
`docs/little-steps-prototype.html` for every screen, word and behavior.

**Build status:** step 3 of 9. Done: data model, sign in, families,
invitations, roles and family separation (step 1); visits with true weekly
recurrence and the Home week view (step 2); the diary and the Home tiles
(step 3). Visits and diary moments update live for everyone in the family.

## Stack

- Next.js (App Router, TypeScript), installable on phones later as a PWA
- Supabase: Postgres with row level security, Auth (email link), private Storage
- Vitest for unit and database tests

## How family data is kept separate

The database enforces it, not the app code. `supabase/migrations` holds the rules:

- Every record has a `family_id`. A signed-in person reaches a family's records
  only through their row in `family_members`.
- Records about a child point at `(child_id, family_id)` together, so a record
  can never name another family's child.
- A record's `family_id` can never change, so someone in two families cannot
  move data between them.
- Roles: **Owner** (everything, including invitations and deleting a child's
  data), **Family** (sees and changes everything), **Viewer** (sees everything,
  changes nothing), **Helper** (sees and changes only the care areas the owner
  picks, such as a home nurse seeing the diary and adding nurse notes, and can
  delete only what they added).
- Invitation links are single use, tied to one email address, expire after 14
  days, and only a hash of the token is stored.
- Every add, change and delete is written to `audit_log` with who did it. Only
  owners can read it, and nobody can edit it.
- `delete_child()` permanently removes a child, every record about them, and
  their audit history, leaving one note that a deletion happened.
- Photos live in a private bucket under `<family_id>/<child_id>/`.
- The app has no service key. Every query runs as the signed-in person.

`tests/db` proves all of this with invented families (the Riveras and the
Okafors): one family cannot read, add to, change or delete anything of
another's, and each role can do exactly what it should.

## Run it locally

Needs Node 22, pnpm and Docker.

```bash
pnpm install
pnpm dlx supabase start       # Postgres, Auth, Storage, local mail viewer; applies migrations and the demo seed
cp .env.example .env.local    # fill in the publishable key that `supabase start` prints
pnpm dev
```

Sign in as `parent@example.com` (Owner), `grandma@example.com` (Family) or
`nurse@example.com` (Helper) and open the sign-in link from the mail viewer at
http://127.0.0.1:54324. The demo child is Josiah; everything else about him is
invented.

## Tests

```bash
pnpm lint && pnpm typecheck && pnpm test   # unit tests
pnpm test:db                               # database tests against `supabase start`
pnpm test:db:local                         # same tests on plain Postgres in Docker, when Supabase can't start
pnpm test:e2e                              # browser tests: needs `supabase start` and the app on :3000
```

Weekly visits are one rule in `visit_series` (start date, every N weeks, end
date). Dates are worked out from it (`src/lib/visits.ts`); a row in `visits`
exists for a series date only when it has its own notes, a new day or time, or
was cancelled.

Diary moments share one table, `moments`, with a `type` and the fields for that
type in `details`. The kinds, their fields and words come from the prototype's
`LOG` config and live in `src/lib/moments.ts`, which also checks submitted
values and works out the night feed total.

`test:db:local` uses `tests/db/supabase-shim.sql` to stand in for Supabase's
`auth` and `storage` schemas. CI runs the database tests against real Supabase.

## Rules that must not change

From the brief: the child comes first; no percentiles or comparison with other
children; warm words ("Meals", "Keep an eye on", "Josiah's helpers", "Not yet"), using the child's name rather than pronouns;
no alarm red except on delete; AI only drafts and a person always saves; AI
never edits medicines; the Claude API is called only from the server; never use
real patient data in development or tests.
