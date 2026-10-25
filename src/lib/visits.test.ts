import { describe, expect, it } from "vitest";
import {
  endingSoon,
  isSeriesDate,
  occurrenceKey,
  parseVisitKey,
  previousSeriesDate,
  seriesDates,
  seriesEnd,
  visitsBetween,
  type SeriesRow,
  type VisitRow,
} from "./visits";

const pt: SeriesRow = {
  id: "s1",
  child_id: "c1",
  kind: "Physical therapy",
  title: "PT",
  provider: "Example Therapy",
  location: "Home",
  who: null,
  bring: null,
  notes: null,
  starts_on: "2026-03-02", // a Monday
  start_time: "10:00:00",
  every_weeks: 1,
  ends_on: "2026-03-23", // 4 visits
  end_confirmed_at: null,
};

const row = (over: Partial<VisitRow>): VisitRow => ({
  id: "v1",
  child_id: "c1",
  series_id: null,
  occurrence_date: null,
  kind: "Cardiology",
  title: null,
  provider: null,
  location: null,
  who: null,
  bring: null,
  notes: null,
  date: "2026-03-10",
  time: "09:00:00",
  summary: null,
  homework: null,
  cancelled: false,
  ...over,
});

describe("weekly series", () => {
  it("lands on the same weekday every week until it ends", () => {
    expect(seriesDates(pt, "2026-01-01", "2026-12-31")).toEqual(["2026-03-02", "2026-03-09", "2026-03-16", "2026-03-23"]);
  });

  it("only returns dates inside the window", () => {
    expect(seriesDates(pt, "2026-03-10", "2026-03-20")).toEqual(["2026-03-16"]);
    expect(seriesDates(pt, "2026-03-09", "2026-03-09")).toEqual(["2026-03-09"]);
    expect(seriesDates(pt, "2026-03-24", "2026-04-30")).toEqual([]);
  });

  it("supports every other week, and series with no end date", () => {
    const biweekly = { ...pt, every_weeks: 2, ends_on: null };
    expect(seriesDates(biweekly, "2026-03-03", "2026-04-15")).toEqual(["2026-03-16", "2026-03-30", "2026-04-13"]);
  });

  it("is a true rule, not copies: extending the end date adds weeks", () => {
    expect(seriesDates({ ...pt, ends_on: "2026-04-06" }, "2026-03-20", "2026-12-31")).toEqual([
      "2026-03-23",
      "2026-03-30",
      "2026-04-06",
    ]);
  });

  it("works across daylight saving time and year ends", () => {
    const winter = { ...pt, starts_on: "2026-12-28", ends_on: "2027-01-11" };
    expect(seriesDates(winter, "2026-12-01", "2027-02-01")).toEqual(["2026-12-28", "2027-01-04", "2027-01-11"]);
    const spring = { ...pt, starts_on: "2026-03-02", ends_on: "2026-03-16" }; // US clocks change 2026-03-08
    expect(seriesDates(spring, "2026-03-01", "2026-03-31")).toEqual(["2026-03-02", "2026-03-09", "2026-03-16"]);
  });

  it("knows its own dates", () => {
    expect(isSeriesDate(pt, "2026-03-16")).toBe(true);
    expect(isSeriesDate(pt, "2026-03-17")).toBe(false);
    expect(isSeriesDate(pt, "2026-02-23")).toBe(false);
    expect(isSeriesDate(pt, "2026-03-30")).toBe(false);
  });

  it("works out end dates and the date before", () => {
    expect(seriesEnd("2026-03-02", 4)).toBe("2026-03-23");
    expect(seriesEnd("2026-03-02", 1)).toBe("2026-03-02");
    expect(previousSeriesDate(pt, "2026-03-16")).toBe("2026-03-09");
    expect(previousSeriesDate(pt, "2026-03-02")).toBeNull();
  });
});

describe("visitsBetween", () => {
  it("mixes one-off visits with series dates in time order", () => {
    const visits = visitsBetween([row({ date: "2026-03-09", time: "08:00:00" })], [pt], "2026-03-09", "2026-03-09");
    expect(visits.map((v) => [v.kind, v.time])).toEqual([
      ["Cardiology", "08:00:00"],
      ["Physical therapy", "10:00:00"],
    ]);
  });

  it("uses a series date's own row when it has one, even if moved to another day", () => {
    const moved = row({ id: "o1", series_id: "s1", occurrence_date: "2026-03-09", date: "2026-03-10", kind: "Physical therapy", summary: "Rolled over!" });
    const visits = visitsBetween([moved], [pt], "2026-03-08", "2026-03-11");
    expect(visits).toHaveLength(1);
    expect(visits[0]).toMatchObject({ key: "o1", date: "2026-03-10", summary: "Rolled over!" });
  });

  it("leaves out cancelled visits", () => {
    const cancelled = row({ id: "o2", series_id: "s1", occurrence_date: "2026-03-16", date: "2026-03-16", cancelled: true });
    expect(visitsBetween([cancelled], [pt], "2026-03-16", "2026-03-16")).toEqual([]);
  });

  it("gives series dates without a row a key that leads back to them", () => {
    const [visit] = visitsBetween([], [pt], "2026-03-16", "2026-03-16");
    expect(visit.key).toBe(occurrenceKey("s1", "2026-03-16"));
    expect(parseVisitKey(visit.key)).toEqual({ seriesId: "s1", date: "2026-03-16" });
    expect(parseVisitKey("abc")).toEqual({ id: "abc" });
  });

  it("puts visits without a time at the end of the day", () => {
    const visits = visitsBetween([row({ id: "a", time: null }), row({ id: "b", time: "15:00:00" })], [], "2026-03-10", "2026-03-10");
    expect(visits.map((v) => v.key)).toEqual(["b", "a"]);
  });
});

describe("endingSoon", () => {
  it("asks about a series in the weeks before it ends, until someone answers", () => {
    expect(endingSoon([pt], "2026-03-08", 14)).toEqual([]);
    expect(endingSoon([pt], "2026-03-09", 14)).toEqual([pt]);
    expect(endingSoon([pt], "2026-03-23", 14)).toEqual([pt]);
    expect(endingSoon([pt], "2026-03-24", 14)).toEqual([]);
    expect(endingSoon([{ ...pt, end_confirmed_at: "2026-03-10T12:00:00Z" }], "2026-03-12", 14)).toEqual([]);
    expect(endingSoon([{ ...pt, ends_on: null }], "2026-03-12", 14)).toEqual([]);
  });
});
