# Running the pilot

The build brief's step 9: five to ten families use JOSIA Care for a few weeks,
and what they do tells us what to build next. This guide covers pilot codes,
reading feedback, and what to watch. Putting the app online is in
`docs/DEPLOY.md`.

## Pilot codes

With invite only on (`docs/DEPLOY.md`, step 5), a family needs a pilot code
to start a Care Circle. Grandparents, nurses and helpers they invite never
need one.

Make one code per family in the Supabase SQL Editor. The label is for you;
codes ignore capital letters and spaces.

```sql
insert into private.pilot_codes (code_hash, label, uses_left)
values (private.code_hash('RIVER-4821'), 'Family 1, referred by the NICU parent group', 1);
```

Only a hash of the code is stored, so write the code down before you send it.
Send it with the app's address, for example:

> Thank you for trying JOSIA Care. Open https://app.josiacare.com on your
> phone, sign in with your email, and enter the pilot code RIVER-4821.

To see which codes were used: `select label, uses_left from private.pilot_codes;`
To let a family make a second Care Circle, add another use:
`update private.pilot_codes set uses_left = uses_left + 1 where label = '...';`

## Feedback

Everyone in a Care Circle can tap **Care Circle → Send us feedback**. No one in
the Care Circle can read it, not even the owner. Read it in the SQL Editor:

```sql
select f.created_at, u.email, f.page, f.message
from private.feedback f left join auth.users u on u.id = f.user_id
order by f.created_at desc;
```

The page shows where they were when they wrote. You can reply by email.

## What to watch

These questions decide what comes next. A weekly look in the SQL Editor is
enough; nothing here reads a family's notes.

```sql
-- Care Circles and how many people are in each
select f.name, count(m.user_id) as people from public.families f
join public.family_members m on m.family_id = f.id group by f.name;

-- What families log most, over the last two weeks
select type, count(*) from public.moments
where created_at > now() - interval '14 days' group by type order by count(*) desc;

-- How many people use reminders
select count(distinct user_id) from public.push_devices;
```

Questions to ask each family at the end of week one and week four:

1. What did you open JOSIA Care for most this week?
2. Did anyone you invited use it? What did they do?
3. What did you still keep on paper, in texts or in your head?
4. Was anything confusing, slow or worrying?
5. Would you miss it if it went away? Would you pay for it, and how much?

## Before paid plans

Stripe subscriptions come after the pilot (build brief, step 9). Their answers
to question 5, and which features they used, tell us what the plans should be.
