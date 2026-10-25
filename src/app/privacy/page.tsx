import type { Metadata } from "next";
import Link from "next/link";
import { contactEmail } from "@/lib/contact";

export const metadata: Metadata = { title: "Privacy · JOSIA Care" };

export default function PrivacyPage() {
  const email = contactEmail();
  return (
    <main className="band">
      <article className="inner stack prose">
        <section>
          <p className="eyebrow">JOSIA Care</p>
          <h1>Privacy</h1>
          <p className="muted">Pilot version, October 2026. In plain words: what we keep, who sees it, and how to take it with you.</p>
        </section>

        <section className="card pad">
          <h2>What we keep</h2>
          <ul>
            <li>Your name and email, so you can sign in with a link.</li>
            <li>What your Care Circle adds: visits, the diary, medicines, the emergency card, equipment, wins, questions and photos.</li>
            <li>Who added or changed each thing and when, so the Care Circle can trust what it sees.</li>
            <li>Your reminder choices and your phone&rsquo;s push address, if you turn reminders on.</li>
          </ul>
        </section>

        <section className="card pad">
          <h2>Who sees it</h2>
          <ul>
            <li>Only people the Care Circle&rsquo;s owner invites, and each person sees only what their role allows. The database enforces this, not just the app.</li>
            <li>Reminder settings and feedback you send are yours alone. No one else in the Care Circle can read them.</li>
            <li>The people who run JOSIA Care can reach the database to keep it working and safe. We look at a Care Circle&rsquo;s records only when you ask us for help, or to protect the service.</li>
            <li>We do not sell your information, show ads, or use tracking or analytics tools.</li>
          </ul>
        </section>

        <section className="card pad">
          <h2>Services we use</h2>
          <ul>
            <li>Supabase stores the records and photos and sends sign-in emails. Photos are private and shown through links that expire after an hour.</li>
            <li>Our hosting provider runs the app.</li>
            <li>
              Claude, from Anthropic, reads only what you choose to share when you tap &ldquo;Sort it for me&rdquo;: the words or photo you
              paste, nothing else about your family. We do not store the photo. Claude only drafts, and nothing is saved until a person taps
              Save.
            </li>
            <li>Apple, Google or your browser deliver reminders. A reminder shows the kind of visit and the time, never notes.</li>
          </ul>
        </section>

        <section className="card pad">
          <h2>Take it with you, or delete it</h2>
          <ul>
            <li>The owner can download all the Care Circle&rsquo;s records as one file from Settings.</li>
            <li>The owner can permanently delete a child&rsquo;s data, photos included, from Settings.</li>
            <li>To close your account or remove a whole Care Circle, contact us{email ? <> at <a href={`mailto:${email}`}>{email}</a></> : ""}.</li>
          </ul>
        </section>

        <section className="card pad">
          <h2>Good to know</h2>
          <ul>
            <li>JOSIA Care is an organizing tool for families. It is not a medical provider or a health plan, and it is not set up as a HIPAA-covered service.</li>
            <li>Accounts are for adults. The child is someone the Care Circle cares for, not an account.</li>
            <li>Please use JOSIA Care only for people you care for and information you are allowed to share.</li>
            <li>If this page changes, we will tell you in the app first.</li>
          </ul>
          {email ? (
            <p>
              Questions? Write to <a href={`mailto:${email}`}>{email}</a>.
            </p>
          ) : null}
        </section>

        <p className="small">
          <Link href="/terms">Terms</Link> · <Link href="/">JOSIA Care</Link>
        </p>
      </article>
    </main>
  );
}
