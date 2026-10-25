import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { canView } from "@/lib/access";
import { todayIn } from "@/lib/dates";
import { safeNext } from "@/lib/errors";
import { getFamily } from "@/lib/session";
import { sheetAsText } from "@/lib/visit-sheet";
import { loadVisitSheet } from "@/lib/visit-sheet-data";
import { loadVisit } from "@/lib/visits-data";
import styles from "./sheet.module.css";

/** The visit sheet: one tap gathers what the next doctor or therapist should know. No AI. */
export default async function VisitSheetPage({ params, searchParams }: PageProps<"/f/[familyId]/visits/[visitKey]/sheet">) {
  const { familyId, visitKey } = await params;
  const query = await searchParams;
  const { family, children, me } = await getFamily(familyId);
  if (!canView(me, "visits")) notFound();
  const { visit } = await loadVisit(family.id, decodeURIComponent(visitKey));
  const child = children.find((c) => c.id === visit.child_id) ?? children[0];
  const sheet = await loadVisitSheet({
    familyId: family.id,
    childId: child.id,
    childName: child.name,
    visit,
    today: todayIn(family.time_zone),
    unit: family.feed_unit,
  });
  const back = safeNext(query.next, `/f/${family.id}/visits/${encodeURIComponent(visit.key)}`);

  return (
    <>
      <div className={styles.noPrint}>
        <p className="eyebrow">Visit sheet</p>
        <p className="muted small">Copy it into a text, an email or a portal message, or show this screen at check in.</p>
      </div>
      <article className={`card ${styles.sheet}`} aria-label="Visit sheet">
        <h1 className={styles.title}>{sheet.title}</h1>
        <p className="muted small">{sheet.sub}</p>
        {sheet.sections.map((sec) => (
          <section key={sec.title} className={styles.sec}>
            <h2 className="eyebrow">{sec.title}</h2>
            <ul>
              {sec.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </article>
      <div className={`actions ${styles.noPrint}`}>
        <CopyButton text={sheetAsText(sheet)} label="Copy sheet" primary long />
        <Link className="btn" href={back}>
          Back to the visit
        </Link>
      </div>
      {me.role === "helper" ? (
        <p className={`muted small ${styles.noPrint}`}>This sheet only includes the parts of the tracker the family has shared with you.</p>
      ) : null}
    </>
  );
}
