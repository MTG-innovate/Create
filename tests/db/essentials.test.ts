import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RLS_DENIED, addMember, as, createFamily, createPerson, errorCode, insertRow, pool, sampleRows, tryAs, type Family, type Person } from "./helpers";

// Little Steps essentials: corrected age, medicine times, the emergency card,
// pumping and equipment and supplies. Supplies are also in sampleRows, so the
// separation, role and audit tests cover them like every care table.

let fam: Family;
let grandma: Person;
let nurse: Person;
let sitter: Person;

beforeAll(async () => {
  fam = await createFamily(await createPerson("Essentials Owner"), "Essentials Care Circle", "Mia");
  grandma = await addMember(fam, await createPerson("Essentials Grandma"), { role: "viewer" });
  nurse = await addMember(fam, await createPerson("Essentials Nurse"), { role: "helper", view: ["diary", "medicines"], edit: ["diary"] });
  sitter = await addMember(fam, await createPerson("Essentials Sitter"), { role: "helper", view: ["diary"], edit: ["diary"] });
});

afterAll(() => pool.end());

describe("the emergency card and corrected age", () => {
  it("owners and family fill them in; everyone in the Care Circle can read them", async () => {
    await as(fam.owner, (q) =>
      q("update public.children set due_date = '2025-08-01', conditions = 'Heart murmur', allergies = 'None known', emergency_plan = 'Call 911', hospital = 'Example Children''s' where id = $1", [fam.childId]),
    );
    for (const person of [grandma, nurse, sitter]) {
      const { rows } = await tryAs(person, (q) => q("select due_date, conditions, allergies, emergency_plan, hospital from public.children where id = $1", [fam.childId]));
      expect(rows[0]).toMatchObject({ conditions: "Heart murmur", allergies: "None known", hospital: "Example Children's" });
    }
    for (const person of [grandma, nurse, sitter]) {
      await tryAs(person, async (q) => {
        expect((await q("update public.children set allergies = 'Changed' where id = $1", [fam.childId])).rowCount).toBe(0);
      });
    }
  });

  it("a due date must be near the birthday", async () => {
    // The test family's child was born 2025-06-01.
    expect(await errorCode(tryAs(fam.owner, (q) => q("update public.children set due_date = '2024-01-01' where id = $1", [fam.childId])))).toBe("23514");
    expect(await errorCode(tryAs(fam.owner, (q) => q("update public.children set due_date = '2025-09-15' where id = $1", [fam.childId])))).toBe("ok");
  });
});

describe("medicine times", () => {
  it("are kept with the medicine, up to six a day", async () => {
    const id = await as(fam.owner, (q) => insertRow(q, "medicines", { ...sampleRows(fam.id, fam.childId).medicines, times: "{08:00,20:00}" }));
    const { rows } = await pool.query("select times::text[] as times from public.medicines where id = $1", [id]);
    expect(rows[0].times).toEqual(["08:00:00", "20:00:00"]);
    expect(
      await errorCode(tryAs(fam.owner, (q) => q("update public.medicines set times = '{1:00,2:00,3:00,4:00,5:00,6:00,7:00}' where id = $1", [id]))),
    ).toBe("23514");
  });
});

describe("pumping", () => {
  it("is a diary moment, so anyone who adds to the diary can log it", async () => {
    const row = { family_id: fam.id, child_id: fam.childId, type: "pumping", date: "2026-03-01", details: { amount: 4, unit: "oz" } };
    expect(await errorCode(tryAs(sitter, (q) => insertRow(q, "moments", row)))).toBe("ok");
    expect(await errorCode(tryAs(grandma, (q) => insertRow(q, "moments", row)))).toBe(RLS_DENIED);
  });
});

describe("equipment and supplies", () => {
  it("follow the medicines care area", async () => {
    const row = sampleRows(fam.id, fam.childId).supplies;
    const id = await as(fam.owner, (q) => insertRow(q, "supplies", row));
    await tryAs(nurse, async (q) => {
      expect((await q("select 1 from public.supplies where id = $1", [id])).rowCount).toBe(1);
      expect((await q("update public.supplies set notes = 'x' where id = $1", [id])).rowCount).toBe(0);
    });
    expect(await errorCode(tryAs(nurse, (q) => insertRow(q, "supplies", row)))).toBe(RLS_DENIED);
    await tryAs(sitter, async (q) => {
      expect((await q("select 1 from public.supplies where id = $1", [id])).rowCount).toBe(0);
    });
  });
});

describe("the migration", () => {
  it("keeps every child and medicine, and the rollback undoes it", async () => {
    const migration = readFileSync("supabase/migrations/20261028000000_baby_essentials.sql", "utf8");
    const rollback = readFileSync("supabase/rollbacks/20261028000000_baby_essentials.sql", "utf8");
    const client = await pool.connect();
    try {
      await client.query("begin");
      const before = await client.query("select (select count(*) from public.children) as children, (select count(*) from public.medicines) as medicines");
      await client.query(rollback);
      expect((await client.query("select to_regclass('public.supplies') as t")).rows[0].t).toBeNull();
      await client.query(migration);
      const after = await client.query("select (select count(*) from public.children) as children, (select count(*) from public.medicines) as medicines");
      expect(after.rows[0]).toEqual(before.rows[0]);
      const times = await client.query("select count(*)::int as n from public.medicines where times <> '{}'");
      expect(times.rows[0].n).toBe(0);
    } finally {
      await client.query("rollback");
      client.release();
    }
  });
});
