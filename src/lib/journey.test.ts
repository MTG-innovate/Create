import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fmtGain, gainLabel, growthChart, lastDays, measureChange, niceMax, upSince, weighIns, type Win } from "./journey";
import type { Moment } from "./moments";

let n = 0;
const weigh = (date: string, lb: number, oz: number, extra: Record<string, unknown> = {}, note: string | null = null): Moment => ({
  id: `w${++n}`,
  child_id: "c1",
  type: "weigh_in",
  date,
  time: "10:00",
  details: { lb, oz, ...extra },
  note,
  created_by: null,
});

const list = weighIns([
  weigh("2026-03-01", 7, 8, { length: 20.5 }),
  weigh("2026-02-01", 5, 2, { length: 18.75, head: 13 }, "Birth weight"),
  weigh("2026-04-01", 9, 0, { length: 22, head: 14.5 }),
  { ...weigh("2026-04-02", 0, 0), details: {} }, // no weight: left out
]);

describe("weigh-ins", () => {
  it("are oldest first and keep only those with a weight", () => {
    expect(list.map((w) => [w.date, w.oz])).toEqual([
      ["2026-02-01", 82],
      ["2026-03-01", 120],
      ["2026-04-01", 144],
    ]);
  });

  it("each show the gain since the one before", () => {
    expect([0, 1, 2].map((i) => gainLabel(list, i))).toEqual([
      { text: "First", up: false },
      { text: "+2 lb 6 oz", up: true },
      { text: "+1 lb 8 oz", up: true },
    ]);
    const same = weighIns([weigh("2026-01-01", 6, 0), weigh("2026-01-08", 6, 0), weigh("2026-01-15", 5, 15)]);
    expect([gainLabel(same, 1).text, gainLabel(same, 2).text]).toEqual(["Same", "−1 oz"]);
  });

  it("say how much has been gained, warmly", () => {
    expect([fmtGain(6.5), fmtGain(16), fmtGain(62), fmtGain(-3)]).toEqual(["6.5 oz", "1 lb", "3 lb 14 oz", "3 oz"]);
  });

  it("give the Home badge: up since birth", () => {
    expect(upSince(list, null)).toEqual({ gain: "3 lb 14 oz", since: "birth" });
    expect(upSince(weighIns([weigh("2026-02-01", 5, 0), weigh("2026-03-01", 6, 0)]), "2026-02-01")?.since).toBe("birth");
    expect(upSince(weighIns([weigh("2026-02-10", 5, 0), weigh("2026-03-01", 6, 0)]), "2026-02-01")?.since).toBe("2026-02-10");
    expect(upSince(list.slice(0, 1), null)).toBeNull();
  });

  it("track length and head growth", () => {
    expect(measureChange(list, "length")).toEqual({ latest: 22, date: "2026-04-01", up: 3.3, since: "2026-02-01" });
    expect(measureChange(list, "head")).toEqual({ latest: 14.5, date: "2026-04-01", up: 1.5, since: "2026-02-01" });
  });
});

describe("growth chart", () => {
  const wins: Win[] = [
    { id: "a", child_id: "c1", title: "First smile", happened_on: "2026-03-15", category: "A first", note: null },
    { id: "b", child_id: "c1", title: "Long ago", happened_on: "2025-12-01", category: "Just because", note: null },
  ];
  const chart = growthChart(list, wins);

  it("places weigh-ins left to right in time, heavier higher", () => {
    const [a, b, c] = chart.points;
    expect(a.x).toBe(chart.plot.left);
    expect(c.x).toBe(chart.plot.right);
    expect(b.x).toBeGreaterThan(a.x);
    expect(a.y).toBeGreaterThan(b.y);
    expect(b.y).toBeGreaterThan(c.y);
    for (const p of chart.points) {
      expect(p.y).toBeGreaterThanOrEqual(chart.plot.top);
      expect(p.y).toBeLessThanOrEqual(chart.plot.bottom);
    }
  });

  it("puts wins inside the chart's dates on it as stars", () => {
    expect(chart.stars.map((s) => s.win.id)).toEqual(["a"]);
  });

  it("has pound labels and works with a single weigh-in", () => {
    expect(chart.ticks.every((t) => / lb$/.test(t.label))).toBe(true);
    const single = growthChart(list.slice(0, 1), wins);
    expect(single.points[0].x).toBe((single.plot.left + single.plot.right) / 2);
    expect(single.stars).toEqual([]);
  });
});

describe("the last 14 days", () => {
  it("has one value per day, with meals and playtime", () => {
    const moments: Moment[] = [
      { id: "1", child_id: "c1", type: "meal", date: "2026-04-14", time: "08:00", details: { amount: 3, unit: "oz" }, note: null, created_by: null },
      { id: "2", child_id: "c1", type: "playtime", date: "2026-04-13", time: "09:00", details: { minutes: 15 }, note: null, created_by: null },
    ];
    const days = lastDays(moments, "2026-04-14", 14, "oz");
    expect(days).toHaveLength(14);
    expect(days[0].date).toBe("2026-04-01");
    expect(days[13]).toEqual({ date: "2026-04-14", meals: 3, play: 0 });
    expect(days[12].play).toBe(15);
  });

  it("rounds axis maximums", () => {
    expect([niceMax(0), niceMax(7), niceMax(18), niceMax(26), niceMax(240), niceMax(30)]).toEqual([1, 8, 20, 30, 300, 30]);
  });
});

describe("the firm rule", () => {
  it("never compares the child to other children", () => {
    const source = readFileSync(new URL("./journey.ts", import.meta.url), "utf8").toLowerCase();
    expect(source.replace(/no percentiles/g, "")).not.toMatch(/percentile|z-?score|who growth|cdc/);
  });
});
