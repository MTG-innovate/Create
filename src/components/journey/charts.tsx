import type { ReactNode } from "react";
import { fmtDay } from "@/lib/dates";
import { WIN_COLOR, growthChart, niceMax, starPoints, type WeighIn, type Win } from "@/lib/journey";
import { fmtWeight } from "@/lib/moments";
import styles from "./journey.module.css";

// Charts drawn on the server as SVG, in the prototype's style. Each point,
// bar and star has a native tooltip, and every chart has a table of the
// numbers behind it, so nothing depends on seeing color.

const short = (d: string) => fmtDay(d, { month: "short", day: "numeric" });

export function GrowthChartView({ list, wins }: { list: WeighIn[]; wins: Win[] }) {
  const c = growthChart(list, wins);
  const { left, right, bottom } = c.plot;
  const path = c.points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = c.points[c.points.length - 1];

  return (
    <figure className={`card ${styles.chart}`} style={{ margin: 0 }}>
      <figcaption className={styles.cap}>
        <span className="muted small">Weight at every weigh in</span>
        {c.stars.length ? (
          <span className="muted small">
            <span className={styles.starkey} /> a win
          </span>
        ) : null}
      </figcaption>
      <svg viewBox={`0 0 ${c.width} ${c.height}`} role="img" aria-label={`Weight over time, from ${fmtWeight(list[0].oz)} to ${fmtWeight(last.w.oz)}`}>
        <defs>
          <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--feed)", stopOpacity: 0.32 }} />
            <stop offset="1" style={{ stopColor: "var(--accent)", stopOpacity: 0.04 }} />
          </linearGradient>
        </defs>
        {c.ticks.map((t) => (
          <g key={t.label}>
            <line x1={left} x2={right} y1={t.y} y2={t.y} style={{ stroke: "var(--line)" }} strokeDasharray="3 4" />
            <text x={left - 8} y={t.y + 4} textAnchor="end" fontSize="10" style={{ fill: "var(--muted)" }}>
              {t.label}
            </text>
          </g>
        ))}
        {c.points.length > 1 ? (
          <>
            <path d={`${path} L${last.x},${bottom} L${c.points[0].x},${bottom} Z`} style={{ fill: "url(#growthFill)" }} />
            <path d={path} fill="none" style={{ stroke: "var(--feed)" }} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          </>
        ) : null}
        {c.stars.map((s) => (
          <polygon key={s.win.id} points={starPoints(s.x, bottom + 12, 6)} style={{ fill: `var(${WIN_COLOR[s.win.category]})`, stroke: "var(--accent-text)" }} strokeWidth="1">
            <title>{`${short(s.win.happened_on)}: ${s.win.title}`}</title>
          </polygon>
        ))}
        {c.points.map((p, i) => {
          const isLast = i === c.points.length - 1;
          return (
            <circle key={p.w.id} cx={p.x} cy={p.y} r={isLast ? 6 : 4} style={{ fill: isLast ? "var(--feed)" : "var(--surface)", stroke: "var(--feed)" }} strokeWidth="2">
              <title>{`${short(p.w.date)}: ${fmtWeight(p.w.oz)}`}</title>
            </circle>
          );
        })}
        <text x={Math.min(Math.max(last.x, left + 40), right - 40)} y={last.y - 14} textAnchor="middle" fontSize="12" fontWeight="700" style={{ fill: "var(--ink)" }}>
          {fmtWeight(last.w.oz)}
        </text>
        <text x={left} y={c.height - 6} fontSize="10" style={{ fill: "var(--muted)" }}>
          {short(c.first)}
        </text>
        {c.points.length > 1 ? (
          <text x={right} y={c.height - 6} textAnchor="end" fontSize="10" style={{ fill: "var(--muted)" }}>
            {short(c.last)}
          </text>
        ) : null}
      </svg>
      <Numbers head={["Date", "Weight"]} rows={list.map((w) => [short(w.date), fmtWeight(w.oz)])} />
    </figure>
  );
}

/** The prototype's barChart: one bar per day, today's at full strength. */
export function DailyBars({
  title,
  caption,
  today,
  days,
  color,
  format,
}: {
  title: string;
  caption: [string, string];
  today: string;
  days: { date: string; value: number }[];
  color: string;
  format: (v: number) => string;
}) {
  const W = 340;
  const H = 160;
  const pl = 34;
  const pr = 6;
  const pt = 10;
  const pb = 24;
  const max = niceMax(Math.max(0, ...days.map((d) => d.value)));
  const iw = W - pl - pr;
  const ih = H - pt - pb;
  const bw = iw / days.length;
  const tickLabel = (v: number) => String(Math.round(v * 10) / 10);

  return (
    <section>
      <h2>{title}</h2>
      <figure className={`card ${styles.chart}`} style={{ margin: 0 }}>
        <figcaption className={styles.cap}>
          <span className="muted small">{caption[0]}</span>
          <b className="small">{caption[1]}</b>
        </figcaption>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, ${caption[0].toLowerCase()}`}>
          {[0, 0.5, 1].map((f) => {
            const y = pt + ih - ih * f;
            return (
              <g key={f}>
                <line x1={pl} x2={W - pr} y1={y} y2={y} style={{ stroke: "var(--line)" }} strokeWidth="1" />
                <text x={pl - 6} y={y + 4} textAnchor="end" fontSize="10" style={{ fill: "var(--muted)" }}>
                  {tickLabel(max * f)}
                </text>
              </g>
            );
          })}
          {days.map((d, i) => {
            const h = (ih * d.value) / max;
            const x = pl + i * bw + bw * 0.18;
            const isToday = d.date === today;
            const label: ReactNode =
              i === 0 || i === days.length - 1 || i === Math.floor(days.length / 2) ? (
                <text x={x + bw * 0.32} y={H - 6} textAnchor="middle" fontSize="10" style={{ fill: "var(--muted)" }}>
                  {fmtDay(d.date, { month: "numeric", day: "numeric" })}
                </text>
              ) : null;
            return (
              <g key={d.date}>
                {/* A full-height hit area, so the tooltip works on short bars and empty days too. */}
                <rect x={pl + i * bw} y={pt} width={bw} height={ih} fill="transparent">
                  <title>{`${short(d.date)}: ${d.value ? format(d.value) : "not yet"}`}</title>
                </rect>
                {d.value > 0 ? (
                  <rect x={x} y={pt + ih - h} width={bw * 0.64} height={h} rx="3" style={{ fill: `var(${color})`, opacity: isToday ? 1 : 0.72, pointerEvents: "none" }} />
                ) : null}
                {label}
              </g>
            );
          })}
        </svg>
        <Numbers head={["Day", title]} rows={days.map((d) => [short(d.date), d.value ? format(d.value) : "Not yet"])} />
      </figure>
    </section>
  );
}

function Numbers({ head, rows }: { head: [string, string]; rows: string[][] }) {
  return (
    <details className={styles.numbers}>
      <summary>See the numbers</summary>
      <table>
        <thead>
          <tr>
            <th scope="col">{head[0]}</th>
            <th scope="col">{head[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              <td>{r[0]}</td>
              <td>{r[1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
