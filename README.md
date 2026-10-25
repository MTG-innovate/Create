# Little Steps

One warm, shared place for families caring for a baby or toddler who came home
from the NICU. See `docs/BUILD_BRIEF.pdf` for the product and
`docs/little-steps-prototype.html` for every screen, word and behavior.

**Build status:** step 8 of 9. Done: data model, sign in, families,
invitations, roles and family separation (step 1); visits with true weekly
recurrence and the Home week view (step 2); the diary and the Home tiles
(step 3); the journey, with the growth chart and wins (step 4); helpers,
practice at home, medicines, settings and the child's photo (step 5); questions to ask and the
visit sheet, ready to show, print or copy (step 6); AI capture of a nurse
text, a therapy handoff or a doctor visit summary, always checked by a person
before it saves (step 7); reminders on each person's phone for visits and the
night feed, and Little Steps can be added to the home screen (step 8).
Everything updates live for everyone in the family.

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
- Photos live in a private bucket under `<family_id>/<child_id>/`, are shown
  through signed links that expire after an hour, and a child's record can only
  point at a photo in that child's own folder.
- The family owner can download all the family's records as one JSON file
  (Settings), and permanently delete a child's data, photos included.
- The app has no service key. Every query runs as the signed-in person. The
  one exception is the reminder sender, whose secret lets the database hand
  over only what reminders need (see below).
- Reminder settings and push addresses are personal: each person sees only
  their own phones, and the audit trail never copies a push address.

`tests/db` proves all of this with invented families (the Riveras and the
Okafors): one family cannot read, add to, change or delete anything of
another's, and each role can do exactly what it should.

## Run it locally

Needs Node 22, pnpm and Docker.

```bash
pnpm install
pnpm dlx supabase start       # Postgres, Auth, Storage, local mail viewer; applies migrations and the demo seed
cp .env.example .env.local    # fill in the publishable key that `supabase start` prints, and an Anthropic API key if you have one
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

The journey (`src/lib/journey.ts`) compares the child only to themself: weight
over time with the gain since each weigh-in, and wins as stars along the chart.
It never uses percentiles or growth standards, and a test keeps it that way.

The visit sheet (`src/lib/visit-sheet.ts`) gathers what a helper should know
before a visit: medicines, recent weight, meals and night feeds, what to keep an
eye on, what other helpers said, practice at home and the questions meant for
that helper. It only includes what the person opening it is allowed to see.

AI capture (`src/lib/capture.ts`, `src/lib/claude.ts`) follows the brief's rules:

- Claude only drafts. The draft opens in the usual diary or visit form and
  nothing is written until a person taps Save.
- Medicine changes from a visit go into the visit notes for a person to act on.
  Claude never edits the medicine list or a dose.
- The Claude API is called only from the server, with `ANTHROPIC_API_KEY` from
  the server's environment. Claude gets only the pasted words or photo,
  nothing else about the family. Photos are shrunk in the browser, passed straight through
  and never stored.
- Without a key, the same screens offer "Type it in myself". The end-to-end
  tests use a stand-in for Claude (`tests/e2e/mock-claude.ts`).

Reminders (`src/lib/reminders.ts`, `src/app/api/reminders/route.ts`) are turned
on by each person, phone by phone, in Settings: the evening before a visit
(from 7 PM), about an hour before, and the night feed at a time they pick until
someone logs it. Reminders show the kind of visit and the time, never notes.
On iPhone they work once Little Steps is added to the Home Screen.

To send them, set the VAPID keys and `REMINDER_SECRET` (see `.env.example`),
add the secret's hash to the database once:

```sql
insert into private.reminder_sender (secret_hash) values (sha256(convert_to('<REMINDER_SECRET>', 'UTF8')));
```

and have a scheduler call `/api/reminders` every five minutes with the header
`Authorization: Bearer <REMINDER_SECRET>`. Supabase Cron can do it:

```sql
select cron.schedule('little-steps-reminders', '*/5 * * * *', $$
  select net.http_get('https://<your app>/api/reminders', headers := jsonb_build_object('Authorization', 'Bearer <REMINDER_SECRET>'))
$$);
```

`test:db:local` uses `tests/db/supabase-shim.sql` to stand in for Supabase's
`auth` and `storage` schemas. CI runs the database tests against real Supabase.

## Rules that must not change

From the brief: the child comes first; no percentiles or comparison with other
children; warm words ("Meals", "Keep an eye on", "Josiah's helpers", "Not yet"), using the child's name rather than pronouns;
no alarm red except on delete; AI only drafts and a person always saves; AI
never edits medicines; the Claude API is called only from the server; never use
real patient data in development or tests.
