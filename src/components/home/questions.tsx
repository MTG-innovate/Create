import Link from "next/link";

type Question = { id: string; text: string; for_whom: string | null };

/** "Questions to ask" on Home: open questions, ready for the next visit sheet. */
export function QuestionsToAsk({ familyId, questions, canAdd }: { familyId: string; questions: Question[]; canAdd: boolean }) {
  if (!questions.length) return null;
  const back = encodeURIComponent(`/f/${familyId}`);
  return (
    <section>
      <div className="sec-head">
        <h2>Questions to ask</h2>
        {canAdd ? (
          <Link className="btn small primary" href={`/f/${familyId}/helpers/questions/new?next=${back}`}>
            + Question
          </Link>
        ) : null}
      </div>
      <div className="card list">
        {questions.map((q) => (
          <Link key={q.id} className="row" href={`/f/${familyId}/helpers/questions/${q.id}?next=${back}`} style={{ textDecoration: "none", color: "var(--ink)" }}>
            <span className="main">
              <span className="title" style={{ display: "block" }}>
                {q.text}
              </span>
              {q.for_whom ? <span className="sub">For {q.for_whom}</span> : null}
            </span>
            <span aria-hidden="true">›</span>
          </Link>
        ))}
      </div>
      <p className="muted small">Open questions show up on the visit sheet for the helper they are meant for.</p>
    </section>
  );
}
