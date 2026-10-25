import { ActionForm } from "@/components/action-form";
import { getFamily } from "@/lib/session";
import { sendFeedback } from "./actions";

export default async function FeedbackPage({ params, searchParams }: PageProps<"/f/[familyId]/feedback">) {
  const { familyId } = await params;
  const { from } = await searchParams;
  const { family } = await getFamily(familyId);

  return (
    <>
      <section>
        <h1>Send us feedback</h1>
        <p className="muted">
          What helped today, what got in the way, or what you wish JOSIA Care did. It goes to the JOSIA Care team only, not to anyone in
          your Care Circle.
        </p>
      </section>
      <section className="card pad">
        <ActionForm action={sendFeedback} submit="Send" pendingLabel="Sending…">
          <input type="hidden" name="familyId" value={family.id} />
          <input type="hidden" name="from" value={typeof from === "string" ? from : ""} />
          <div className="field">
            <label htmlFor="message">Your note</label>
            <textarea id="message" name="message" rows={6} required maxLength={2000} placeholder="It would help if…" />
          </div>
        </ActionForm>
        <p className="muted small">We may reply to the email you sign in with. Please leave out anything private about your child&rsquo;s health that we do not need.</p>
      </section>
    </>
  );
}
