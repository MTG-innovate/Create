import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { LiveRefresh } from "@/components/live-refresh";
import { canEdit, canView } from "@/lib/access";
import { fmtDay } from "@/lib/dates";
import { loadMedicines, loadPractice, loadTeam, type PracticeItem } from "@/lib/helpers-data";
import { getFamily } from "@/lib/session";

/** The prototype's Helpers tab (vMore): the care team, practice at home, medicines and helpful numbers. */
export default async function HelpersPage({ params }: PageProps<"/f/[familyId]/helpers">) {
  const { familyId } = await params;
  const { family, children, me } = await getFamily(familyId);
  const name = children.map((c) => c.name).join(" and ");
  const childName = new Map(children.map((c) => [c.id, c.name]));
  const many = children.length > 1;
  const base = `/f/${family.id}/helpers`;
  const add = (kind: string) => `${base}/${kind}/new`;
  const open = (kind: string, id: string) => `${base}/${kind}/${id}`;

  const [team, practice, medicines] = await Promise.all([
    canView(me, "team") ? loadTeam(family.id) : null,
    canView(me, "practice") ? loadPractice(family.id) : null,
    canView(me, "medicines") ? loadMedicines(family.id) : null,
  ]);
  const active = practice?.filter((p) => p.active) ?? [];
  const stopped = practice?.filter((p) => !p.active) ?? [];
  const byProvider = new Map<string, PracticeItem[]>();
  for (const p of active) byProvider.set(p.provider || "Other instructions", [...(byProvider.get(p.provider || "Other instructions") ?? []), p]);

  const practiceRow = (p: PracticeItem) => (
    <Link key={p.id} className="row" href={open("practice", p.id)} style={{ textDecoration: "none", color: "var(--ink)" }}>
      <span className="main">
        <span style={{ display: "block" }}>{p.instruction}</span>
        <span className="sub">
          {[many ? childName.get(p.child_id) : null, p.frequency, p.since ? `Since ${fmtDay(p.since, { month: "short", day: "numeric" })}` : null].filter(Boolean).join(" · ")}
        </span>
      </span>
    </Link>
  );

  return (
    <>
      <section>
        <h1>{name}&rsquo;s helpers</h1>
        <p className="muted">Everyone who helps {name} grow, in one place.</p>
      </section>

      {team ? (
        <section>
          <div className="sec-head">
            <h2>The care team</h2>
            {canEdit(me, "team") ? (
              <Link className="btn small primary" href={add("team")}>
                + Helper
              </Link>
            ) : null}
          </div>
          {team.length ? (
            <div className="card list">
              {team.map((t) => (
                <div key={t.id} className="row">
                  <div className="main">
                    <div className="title">{t.name}</div>
                    {t.role ? <div className="sub">{t.role}</div> : null}
                    {t.phone ? (
                      <a href={`tel:${t.phone.replace(/[^\d+]/g, "")}`} style={{ fontVariantNumeric: "tabular-nums" }}>
                        {t.phone}
                      </a>
                    ) : null}
                    {t.notes ? <div className="sub">{t.notes}</div> : null}
                  </div>
                  <div className="actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
                    {t.phone ? <CopyButton text={t.phone} /> : null}
                    <Link className="btn small" href={open("team", t.id)}>
                      {canEdit(me, "team") ? "Edit" : "View"}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty text={`Add ${name}'s doctors, specialists, therapists, home nurse and pharmacy with their phone numbers.`} href={canEdit(me, "team") ? add("team") : null} label="Add someone" />
          )}
        </section>
      ) : null}

      {practice ? (
        <section>
          <div className="sec-head">
            <h2>Practice at home</h2>
            {canEdit(me, "practice") ? (
              <Link className="btn small primary" href={add("practice")}>
                + Add
              </Link>
            ) : null}
          </div>
          {active.length ? (
            [...byProvider.entries()].map(([provider, items]) => (
              <div key={provider} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <p className="eyebrow">{provider}</p>
                <div className="card list">{items.map(practiceRow)}</div>
              </div>
            ))
          ) : (
            <Empty
              text="When a therapist or doctor shows you something to practice at home, add it here. Daily ones become a gentle checklist on the Home screen."
              href={canEdit(me, "practice") ? add("practice") : null}
              label="Add one"
            />
          )}
          {stopped.length ? (
            <details>
              <summary className="muted" style={{ cursor: "pointer", padding: "8px 0" }}>
                Stopped instructions ({stopped.length})
              </summary>
              <div className="card list">{stopped.map(practiceRow)}</div>
            </details>
          ) : null}
        </section>
      ) : null}

      {medicines ? (
        <section>
          <div className="sec-head">
            <h2>Medicines</h2>
            {canEdit(me, "medicines") ? (
              <Link className="btn small primary" href={add("medicines")}>
                + Medicine
              </Link>
            ) : null}
          </div>
          {medicines.length ? (
            <div className="card list">
              {medicines.map((m) => (
                <Link key={m.id} className="row" href={open("medicines", m.id)} style={{ textDecoration: "none", color: "var(--ink)" }}>
                  <span style={{ width: 4, alignSelf: "stretch", borderRadius: 4, background: "var(--med)", flex: "none" }} aria-hidden="true" />
                  <span className="main">
                    <span className="title" style={{ display: "block" }}>
                      {m.name}
                      {many ? ` · ${childName.get(m.child_id)}` : ""}
                    </span>
                    <span className="sub" style={{ display: "block" }}>
                      {[m.dose, m.when_to_give].filter(Boolean).join(" · ")}
                    </span>
                    {m.prescriber || m.pharmacy ? <span className="sub">{[m.prescriber, m.pharmacy].filter(Boolean).join(" · ")}</span> : null}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <Empty text="Keep the current medicine list here so anyone giving a dose can check it." href={canEdit(me, "medicines") ? add("medicines") : null} label="Add medicine" />
          )}
          <p className="muted small">
            Reread the label each time you prepare a dose, give it exactly as prescribed, and use one pharmacy so the pharmacist knows {name}&rsquo;s history.{" "}
            <a href="https://www.choa.org/patients/after-you-go-home" target="_blank" rel="noopener noreferrer">
              Children&rsquo;s Healthcare of Atlanta guidance
            </a>
          </p>
        </section>
      ) : null}

      <section>
        <h2>Helpful numbers</h2>
        <div className="card list">
          <div className="row">
            <div className="main">
              <div className="title">Emergency</div>
              <a href="tel:911">911</a>
            </div>
          </div>
          <div className="row">
            <div className="main">
              <div className="title">Children&rsquo;s Healthcare of Atlanta</div>
              <a href="tel:4047855437">404-785-KIDS (5437)</a>
            </div>
            <CopyButton text="404-785-5437" />
          </div>
        </div>
      </section>

      <section className="card list">
        <Link className="row" href={`/f/${family.id}/settings`} style={{ textDecoration: "none", color: "var(--ink)" }}>
          <span className="main">
            <span className="title" style={{ display: "block" }}>
              Settings
            </span>
            <span className="sub">Photo, name, birthday, feeding units and daily encouragement</span>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
        <Link className="row" href={`/f/${family.id}/people`} style={{ textDecoration: "none", color: "var(--ink)" }}>
          <span className="main">
            <span className="title" style={{ display: "block" }}>
              Who can see {name}&rsquo;s tracker
            </span>
            <span className="sub">Invite family and helpers, and choose what each person sees</span>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
      </section>

      <p className="muted small" style={{ textAlign: "center" }}>
        JOSIA Care helps everyone in the Care Circle stay organized. It is not medical advice. Follow your care team, and call 911 in an emergency.
      </p>
      <LiveRefresh familyId={family.id} tables={["team_contacts", "practice_items", "medicines"]} />
    </>
  );
}

function Empty({ text, href, label }: { text: string; href: string | null; label: string }) {
  return (
    <div className="card pad">
      <p className="muted">{text}</p>
      {href ? (
        <div className="actions">
          <Link className="btn small" href={href}>
            + {label}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
