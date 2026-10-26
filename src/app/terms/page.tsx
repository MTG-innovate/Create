import type { Metadata } from "next";
import Link from "next/link";
import { contactEmail } from "@/lib/contact";

export const metadata: Metadata = { title: "Terms · JOSIA Care" };

export default function TermsPage() {
  const email = contactEmail();
  return (
    <main className="band">
      <article className="inner stack prose">
        <section>
          <p className="eyebrow">JOSIA Care</p>
          <h1>Terms</h1>
          <p className="muted">Pilot version, October 2026. Thank you for helping us build JOSIA Care.</p>
        </section>

        <section className="card pad">
          <h2>The pilot</h2>
          <ul>
            <li>JOSIA Care is free during the pilot. Things will change as we learn from families like yours.</li>
            <li>We may ask how it is going. Answering is always up to you.</li>
            <li>If the pilot ends, we will tell you at least 30 days ahead, and you can download everything first.</li>
          </ul>
        </section>

        <section className="card pad">
          <h2>Not medical advice</h2>
          <ul>
            <li>JOSIA Care helps a Care Circle stay organized. It does not give medical advice. Follow your care team.</li>
            <li>In an emergency, call 911.</li>
            <li>When Claude drafts from a text or a summary, the draft can be wrong. Check it before you tap Save. Claude never changes medicines or doses.</li>
            <li>Reminders can be late or missed, for example when a phone is off. Do not rely on them alone for medicines or feeds.</li>
          </ul>
        </section>

        <section className="card pad">
          <h2>Your Care Circle</h2>
          <ul>
            <li>What you add is yours. You let us store it and show it to the people in your Care Circle, so the app can work.</li>
            <li>The owner decides who is invited and what each person can see and change.</li>
            <li>Add only information you are allowed to share, and keep your email account safe, since it is how you sign in.</li>
          </ul>
        </section>

        <section className="card pad">
          <h2>The fine print</h2>
          <ul>
            <li>During the pilot, JOSIA Care is offered as it is, without promises that it will always be available or free of mistakes.</li>
            <li>We may pause an account that is used to harm others or the service.</li>
            <li>
              How we handle information is on the <Link href="/privacy">privacy page</Link>.
            </li>
          </ul>
          {email ? (
            <p>
              Questions? Write to <a href={`mailto:${email}`}>{email}</a>.
            </p>
          ) : null}
        </section>

        <p className="small">
          <Link href="/privacy">Privacy</Link> · <Link href="/">JOSIA Care</Link>
        </p>
      </article>
    </main>
  );
}
