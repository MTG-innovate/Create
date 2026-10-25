import { ActionForm } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { canView } from "@/lib/access";
import { buildEmergencyCard } from "@/lib/emergency-card";
import { loadMedicines, loadSupplies, loadTeam } from "@/lib/helpers-data";
import { weighIns } from "@/lib/journey";
import { loadWeighIns } from "@/lib/journey-data";
import { getFamily } from "@/lib/session";
import { sheetAsText } from "@/lib/visit-sheet";
import styles from "../visits/[visitKey]/sheet/sheet.module.css";
import { saveCard } from "../settings/actions";

/**
 * The emergency card: everything a sitter, an ER nurse or EMS needs on one
 * screen, ready to show, copy or print. Each part follows what the person
 * opening it is allowed to see.
 */
export default async function EmergencyCardPage({ params, searchParams }: PageProps<"/f/[familyId]/card">) {
  const { familyId } = await params;
  const query = await searchParams;
  const { family, children, me } = await getFamily(familyId);
  const child = children.find((c) => c.id === query.child) ?? children[0];
  const editable = me.role === "owner" || me.role === "family";

  const [medicines, supplies, team, weights] = await Promise.all([
    canView(me, "medicines") ? loadMedicines(family.id) : null,
    canView(me, "medicines") ? loadSupplies(family.id) : null,
    canView(me, "team") ? loadTeam(family.id) : null,
    canView(me, "growth") ? loadWeighIns(family.id, child.id) : null,
  ]);
  const latest = weights ? weighIns(weights).at(-1) : undefined;
  const card = buildEmergencyCard({
    name: child.name,
    birthDate: child.birth_date,
    dueDate: child.due_date,
    conditions: child.conditions,
    allergies: child.allergies,
    emergencyPlan: child.emergency_plan,
    hospital: child.hospital,
    weight: latest ? { oz: latest.oz, date: latest.date } : null,
    medicines: medicines?.filter((m) => m.child_id === child.id) ?? null,
    equipment: supplies?.filter((s) => s.child_id === child.id && s.category === "Equipment") ?? null,
    team,
    today: new Date(),
  });

  return (
    <>
      <div className={styles.noPrint}>
        <p className="eyebrow">Emergency card</p>
        <p className="muted small">Show it to a sitter, an ER nurse or EMS, or copy it into a text.</p>
      </div>
      <div className={`actions ${styles.noPrint}`}>
        <a className="btn primary" href="tel:911">
          Call 911
        </a>
      </div>
      <article className={`card ${styles.sheet}`} aria-label="Emergency card">
        <h1 className={styles.title}>{card.title}</h1>
        <p className="muted small">{card.sub}</p>
        {card.sections.map((sec) => (
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
        <CopyButton text={sheetAsText(card)} label="Copy card" primary long />
      </div>

      {editable ? (
        <details className={`card pad ${styles.noPrint}`} open={!child.allergies && !child.conditions && !child.emergency_plan}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Fill in {child.name}&rsquo;s card</summary>
          <ActionForm action={saveCard} submit="Save" pendingLabel="Saving…">
            <input type="hidden" name="familyId" value={family.id} />
            <input type="hidden" name="childId" value={child.id} />
            <div className="field">
              <label htmlFor="allergies">Allergies</label>
              <textarea id="allergies" name="allergies" rows={2} maxLength={1000} defaultValue={child.allergies ?? ""} placeholder="Medicines, foods, latex. Leave empty if none are known." />
            </div>
            <div className="field">
              <label htmlFor="conditions">Conditions</label>
              <textarea id="conditions" name="conditions" rows={3} maxLength={2000} defaultValue={child.conditions ?? ""} placeholder="One per line, the way the doctors say them" />
            </div>
            <div className="field">
              <label htmlFor="emergencyPlan">If something happens</label>
              <textarea id="emergencyPlan" name="emergencyPlan" rows={4} maxLength={4000} defaultValue={child.emergency_plan ?? ""} placeholder="What to watch for, who to call first, what to bring" />
            </div>
            <div className="field">
              <label htmlFor="hospital">Preferred hospital</label>
              <input id="hospital" name="hospital" maxLength={300} defaultValue={child.hospital ?? ""} />
            </div>
          </ActionForm>
          <p className="muted small">Medicines, equipment and doctors come from the Care Circle page, so the card stays up to date.</p>
        </details>
      ) : null}
      {me.role === "helper" ? <p className={`muted small ${styles.noPrint}`}>This card only includes the parts of the tracker shared with you.</p> : null}
    </>
  );
}
