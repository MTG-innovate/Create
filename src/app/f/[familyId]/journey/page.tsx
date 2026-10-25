import Link from "next/link";
import { newMomentHref } from "@/components/diary/day-tiles";
import { CelebrateOnArrival } from "@/components/journey/celebrate";
import { DailyBars, GrowthChartView } from "@/components/journey/charts";
import styles from "@/components/journey/journey.module.css";
import { LiveRefresh } from "@/components/live-refresh";
import { canEdit, canView } from "@/lib/access";
import { addDays, fmtDay, todayIn } from "@/lib/dates";
import { WIN_COLOR, fmtGain, gainLabel, lastDays, measureChange, weighIns } from "@/lib/journey";
import { loadWeighIns, loadWins } from "@/lib/journey-data";
import { fmtAmount, fmtWeight } from "@/lib/moments";
import { loadMoments } from "@/lib/moments-data";
import { getFamily } from "@/lib/session";

export default async function JourneyPage({ params, searchParams }: PageProps<"/f/[familyId]/journey">) {
  const { familyId } = await params;
  const query = await searchParams;
  const { family, children, me } = await getFamily(familyId);
  const child = children.find((c) => c.id === query.child) ?? children[0];
  const name = child.name;
  const today = todayIn(family.time_zone);
  const here = `/f/${family.id}/journey${children.length > 1 ? `?child=${child.id}` : ""}`;

  const seesGrowth = canView(me, "growth");
  const seesWins = canView(me, "wins");
  const seesDiary = canView(me, "diary");
  if (!seesGrowth && !seesWins && !seesDiary) {
    return (
      <section className="card pad">
        <h1>{name}&rsquo;s journey</h1>
        <p className="muted">The family has not shared this with you. Ask an owner if you need to see it.</p>
      </section>
    );
  }

  const [weights, wins, recent] = await Promise.all([
    seesGrowth ? loadWeighIns(family.id, child.id).then(weighIns) : Promise.resolve([]),
    seesWins ? loadWins(family.id, child.id) : Promise.resolve([]),
    seesDiary ? loadMoments(family.id, addDays(today, -14), today) : Promise.resolve([]),
  ]);
  const first = weights[0];
  const last = weights[weights.length - 1];
  const gain = weights.length > 1 ? last.oz - first.oz : 0;
  const days = lastDays(recent.filter((m) => m.child_id === child.id), today, 14, family.feed_unit);
  const length = measureChange(weights, "length");
  const head = measureChange(weights, "head");
  const addWeigh = canEdit(me, "growth") ? newMomentHref(family.id, "weigh_in", today, child.id, here) : null;
  const addWin = canEdit(me, "wins") ? `/f/${family.id}/journey/wins/new?${new URLSearchParams({ child: child.id, next: here })}` : null;
  const long = (d: string) => fmtDay(d, { month: "long", day: "numeric" });

  return (
    <>
      <CelebrateOnArrival />
      {children.length > 1 ? (
        <nav className="actions" aria-label="Whose journey">
          {children.map((c) => (
            <Link key={c.id} className={`btn small${c.id === child.id ? " primary" : ""}`} href={`/f/${family.id}/journey?child=${c.id}`} aria-current={c.id === child.id ? "page" : undefined}>
              {c.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <section className={styles.hero}>
        <p className="eyebrow">{name}&rsquo;s journey</p>
        <h1 className={styles.big}>{gain > 0 ? `Up ${fmtGain(gain)}` : last ? fmtWeight(last.oz) : "Every step counts"}</h1>
        <p>
          {weights.length > 1
            ? `since ${long(first.date)}, from ${fmtWeight(first.oz)} to ${fmtWeight(last.oz)}.`
            : last
              ? `${name}'s first weigh in here, ${long(last.date)}. The chart grows with every one you add.`
              : `Log ${name}'s weigh ins and celebrate the wins. The story starts here.`}
        </p>
        <div className={styles.stats}>
          {seesWins ? (
            <span>
              <b>{wins.length}</b> {wins.length === 1 ? "win" : "wins"} celebrated
            </span>
          ) : null}
          {seesGrowth ? (
            <span>
              <b>{weights.length}</b> weigh {weights.length === 1 ? "in" : "ins"}
            </span>
          ) : null}
        </div>
        <p className="small muted">
          This page only compares {name} to {name}. No percentiles, no other babies. Every ounce and every first is progress.
        </p>
        {addWin || addWeigh ? (
          <div className="actions">
            {addWin ? (
              <Link className="btn small primary" href={addWin}>
                Celebrate a win
              </Link>
            ) : null}
            {addWeigh ? (
              <Link className="btn small" href={addWeigh}>
                Log a weigh in
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>

      {seesGrowth ? (
        <section>
          <h2>Growing</h2>
          {weights.length ? (
            <GrowthChartView list={weights} wins={wins} />
          ) : (
            <div className="card pad">
              <p className="muted">Add weigh ins from the pediatrician, specialists or the nurse, and {name}&rsquo;s growth curve draws itself here.</p>
              {addWeigh ? (
                <div className="actions">
                  <Link className="btn small" href={addWeigh}>
                    + Log a weigh in
                  </Link>
                </div>
              ) : null}
            </div>
          )}
          {weights.length ? (
            <div className="card list">
              {weights
                .map((w, i) => ({ w, gain: gainLabel(weights, i) }))
                .slice(-6)
                .reverse()
                .map(({ w, gain: g }) => (
                  <Link key={w.id} className="row" href={`/f/${family.id}/diary/${w.id}?next=${encodeURIComponent(here)}`} style={{ textDecoration: "none", color: "var(--ink)" }}>
                    <span className="main">
                      <span className="title" style={{ display: "block" }}>
                        {fmtWeight(w.oz)}
                      </span>
                      <span className="sub">{[fmtDay(w.date), w.note].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className={`${styles.gain}${g.up ? ` ${styles.up}` : ""}`}>{g.text}</span>
                  </Link>
                ))}
            </div>
          ) : null}
          {length || head ? (
            <div className={styles.measures} style={length && head ? undefined : { gridTemplateColumns: "1fr" }}>
              <Measure label="Length" m={length} />
              <Measure label="Head" m={head} />
            </div>
          ) : null}
        </section>
      ) : null}

      {seesWins ? (
        <section>
          <div className="sec-head">
            <h2>Wins worth celebrating</h2>
            {addWin ? (
              <Link className="btn small primary" href={addWin}>
                + Win
              </Link>
            ) : null}
          </div>
          {wins.length ? (
            <div className="card list">
              {wins.map((w) => (
                <Link key={w.id} className="row" href={`/f/${family.id}/journey/wins/${w.id}?next=${encodeURIComponent(here)}`} style={{ textDecoration: "none", color: "var(--ink)" }}>
                  <span className={styles.winstar} style={{ background: `var(${WIN_COLOR[w.category]})` }} aria-hidden="true" />
                  <span className="main">
                    <span className="title" style={{ display: "block" }}>
                      {w.title}
                    </span>
                    <span className="sub">{[fmtDay(w.happened_on, { month: "long", day: "numeric", year: "numeric" }), w.category].join(" · ")}</span>
                    {w.note ? <span className="sub" style={{ display: "block", whiteSpace: "pre-wrap" }}>{w.note}</span> : null}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="card pad">
              <p className="muted">
                Big or small, write them down: the first time finishing a bottle by mouth, holding {name}&rsquo;s head up in tummy time, a good report from the cardiologist, a first smile. On hard days, this list is the reminder of how far {name} has come.
              </p>
            </div>
          )}
        </section>
      ) : null}

      {days.some((d) => d.meals > 0) ? (
        <DailyBars
          title="Daily meals"
          caption={["Last 14 days, including night feeds", `${fmtAmount(days[13].meals, family.feed_unit)} today`]}
          today={today}
          days={days.map((d) => ({ date: d.date, value: d.meals }))}
          color="--feed"
          format={(v) => fmtAmount(v, family.feed_unit)}
        />
      ) : null}
      {days.some((d) => d.play > 0) ? (
        <DailyBars
          title="Playtime"
          caption={["Minutes, last 14 days", `${days[13].play} min today`]}
          today={today}
          days={days.map((d) => ({ date: d.date, value: d.play }))}
          color="--exercise"
          format={(v) => `${v} min`}
        />
      ) : null}

      <LiveRefresh familyId={family.id} tables={["moments", "wins"]} />
    </>
  );
}

function Measure({ label, m }: { label: string; m: ReturnType<typeof measureChange> }) {
  if (!m) return null;
  return (
    <div className={styles.measure}>
      <div className={styles.k}>{label}</div>
      <div className={styles.v}>{m.latest} in</div>
      <div className={styles.d}>{m.up > 0 ? `Up ${m.up} in since ${fmtDay(m.since, { month: "short", day: "numeric" })}` : fmtDay(m.date)}</div>
    </div>
  );
}
