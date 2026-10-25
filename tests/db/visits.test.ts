import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMember, as, createFamily, createPerson, errorCode, insertRow, pool, tryAs, type Family } from "./helpers";

let fam: Family;
let series: string;

beforeAll(async () => {
  fam = await createFamily(await createPerson("Visits Owner"), "Josiah's family", "Josiah");
  series = await as(fam.owner, (q) =>
    insertRow(q, "visit_series", {
      family_id: fam.id,
      child_id: fam.childId,
      kind: "Physical therapy",
      starts_on: "2026-03-02",
      ends_on: "2026-03-23",
    }),
  );
});

afterAll(() => pool.end());

const note = (occurrence: string, extra: Record<string, unknown> = {}) =>
  tryAs(fam.owner, (q) =>
    insertRow(q, "visits", {
      family_id: fam.id,
      child_id: fam.childId,
      series_id: series,
      occurrence_date: occurrence,
      kind: "Physical therapy",
      date: occurrence,
      summary: "Worked on rolling",
      ...extra,
    }),
  );

describe("weekly series dates", () => {
  it("a visit's own notes can attach to any of the series' dates, even if moved to another day", async () => {
    expect(await errorCode(note("2026-03-16"))).toBe("ok");
    expect(await errorCode(note("2026-03-16", { date: "2026-03-17" }))).toBe("ok");
  });

  it("but never to a day the series does not have", async () => {
    for (const day of ["2026-03-17", "2026-02-23", "2026-03-30"]) {
      expect(await errorCode(note(day)), day).toBe("23514");
    }
  });

  it("each series date has at most one row of its own", async () => {
    await as(fam.owner, async (q) => {
      await insertRow(q, "visits", {
        family_id: fam.id,
        child_id: fam.childId,
        series_id: series,
        occurrence_date: "2026-03-09",
        kind: "Physical therapy",
        date: "2026-03-09",
      });
    });
    expect(await errorCode(note("2026-03-09"))).toBe("23505");
  });

  it("keeping a series going is one change to its end date, not new copies", async () => {
    await as(fam.owner, (q) => q("update public.visit_series set ends_on = ends_on + 84 where id = $1", [series]));
    expect(await errorCode(note("2026-04-13"))).toBe("ok");
    const { rows } = await pool.query("select count(*)::int as n from public.visit_series where family_id = $1", [fam.id]);
    expect(rows[0].n).toBe(1);
  });
});

describe("stopping a weekly series", () => {
  const newSeries = () =>
    as(fam.owner, (q) =>
      insertRow(q, "visit_series", {
        family_id: fam.id,
        child_id: fam.childId,
        kind: "Speech therapy",
        starts_on: "2026-05-04",
        ends_on: "2026-05-25",
      }),
    );

  it("keeps earlier visits and their notes, and removes the rest", async () => {
    const id = await newSeries();
    await as(fam.owner, async (q) => {
      for (const d of ["2026-05-04", "2026-05-18"]) {
        await insertRow(q, "visits", {
          family_id: fam.id,
          child_id: fam.childId,
          series_id: id,
          occurrence_date: d,
          kind: "Speech therapy",
          date: d,
          summary: "Babbled",
        });
      }
      await q("select public.stop_series($1, '2026-05-18')", [id]);
    });
    const { rows: s } = await pool.query(
      "select ends_on::text, end_confirmed_at is not null as answered from public.visit_series where id = $1",
      [id],
    );
    expect(s[0]).toEqual({ ends_on: "2026-05-11", answered: true });
    const { rows: v } = await pool.query("select occurrence_date::text as d from public.visits where series_id = $1", [id]);
    expect(v).toEqual([{ d: "2026-05-04" }]);
  });

  it("removes the series entirely when stopped from its first date", async () => {
    const id = await newSeries();
    await as(fam.owner, (q) => q("select public.stop_series($1, '2026-05-04')", [id]));
    expect((await pool.query("select 1 from public.visit_series where id = $1", [id])).rowCount).toBe(0);
  });

  it("changes nothing for people who cannot change visits", async () => {
    const viewer = await addMember(fam, await createPerson("Series Viewer"), { role: "viewer" });
    const id = await newSeries();
    expect(await errorCode(tryAs(viewer, (q) => q("select public.stop_series($1, '2026-05-11')", [id])))).toBe("42501");
    const { rows } = await pool.query("select ends_on::text from public.visit_series where id = $1", [id]);
    expect(rows[0].ends_on).toBe("2026-05-25");
  });

  it("is not available to other families", async () => {
    const other = await createFamily(await createPerson("Series Stranger"), "Other", "Kai");
    const id = await newSeries();
    expect(await errorCode(tryAs(other.owner, (q) => q("select public.stop_series($1, '2026-05-11')", [id])))).toBe("22023");
  });
});
