# Putting JOSIA Care online

A step-by-step guide for the pilot: a Supabase project for the database, sign
in and photos, and Vercel to run the app. Plan on about an hour. You need a
GitHub account with access to this repository, a computer with Node 22 and
pnpm, and a card for any paid plans you choose.

Never use real patient data until the pilot families sign up themselves.

## 1. Create the Supabase project

1. At supabase.com, create a project. Pick the region closest to your
   families (for example US East) and save the database password somewhere
   safe.
2. On your computer, in this repository:

   ```bash
   pnpm dlx supabase login
   pnpm dlx supabase link --project-ref <your project ref>
   pnpm dlx supabase db push
   ```

   `db push` applies every file in `supabase/migrations`. Do not load
   `supabase/seed.sql`: that is the invented demo family, for local use only.
3. In **Project Settings → API**, copy the project URL and the publishable
   key. The app never needs the service role key; leave it unused.

## 2. Sign-in emails

Supabase's built-in email is for testing: it sends only a few emails an hour,
and only to your own team. Families need a real email service.

1. Sign up with an email service such as Resend or Postmark, and verify a
   sending address on your own domain (for example `hello@josiacare.com`).
2. In Supabase **Authentication → Emails → SMTP Settings**, turn on custom
   SMTP and enter the service's details.
3. In **Authentication → URL Configuration**, set the Site URL to your app's
   address (for example `https://app.josiacare.com`) and add
   `https://app.josiacare.com/**` to Redirect URLs.
4. Optional: in **Authentication → Emails → Templates**, change the Magic Link
   subject to "Your JOSIA Care sign-in link".

## 3. Create the Vercel project

1. At vercel.com, choose **Add New → Project** and import this repository.
   Vercel detects Next.js; keep its build settings.
2. Under **Environment Variables**, add:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | the project URL from step 1 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key from step 1 |
   | `NEXT_PUBLIC_SITE_URL` | your app's address, such as `https://app.josiacare.com` |
   | `CONTACT_EMAIL` | where families reach you, shown on the privacy and terms pages |
   | `ANTHROPIC_API_KEY` | from console.anthropic.com, for AI capture (optional) |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | from `pnpm exec web-push generate-vapid-keys` |
   | `VAPID_SUBJECT` | `mailto:` plus your contact email |
   | `REMINDER_SECRET` | a long random string, such as from `openssl rand -hex 32` |

   Only the `NEXT_PUBLIC_` values reach the browser. Keep the others secret.
3. Deploy. Under **Settings → Domains**, add your domain and follow Vercel's
   DNS steps.

## 4. Reminders

In the Supabase **SQL Editor**, run these once, with your own secret and app
address:

```sql
insert into private.reminder_sender (secret_hash)
values (sha256(convert_to('<REMINDER_SECRET>', 'UTF8')));

create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('josia-reminders', '*/5 * * * *', $$
  select net.http_get('https://app.josiacare.com/api/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer <REMINDER_SECRET>'))
$$);
```

## 5. Invite only

Keep sign-up to the families you invite during the pilot. In the SQL Editor:

```sql
update private.signup set invite_only = true;
```

Then make a pilot code for each family, as in `docs/PILOT.md`. People invited
into an existing Care Circle never need a code.

## 6. Check it works

On your own phone, before inviting anyone:

1. Open the app, sign in with your email, enter a pilot code, and add an
   invented child.
2. Invite a second email address of yours as Family, and open the invitation
   on another device. Both should see the same week within seconds.
3. Add a visit and a diary moment. In Settings, turn on reminders, then send a
   test reminder.
4. With an Anthropic key set, paste an invented nurse text in Nurse text and
   check the draft before saving.
5. In Care Circle → Send us feedback, send a note, and find it in the SQL
   Editor with `select * from private.feedback order by created_at desc;`.
6. Download everything from Settings, then delete the invented child.

## 7. Before families arrive

- Have a lawyer read `/privacy` and `/terms`. They are a plain-language pilot
  draft, not legal advice.
- Turn on Supabase's daily backups (Pro plan) and Point in Time Recovery if
  your budget allows.
- Set a spending limit or alerts on Supabase, Vercel and the Anthropic console.
- Add yourself as the only person with access to the Supabase and Vercel
  projects, and turn on two-factor sign-in for both.
