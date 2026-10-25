import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMember, createFamily, createPerson, errorCode, pool, tryAs, type Family } from "./helpers";

// JOSIA Care, first milestone: each person receiving care follows a journey.
// Everyone who was already in the app is in Little Steps, and the migration
// can be undone.

const MIGRATION = readFileSync("supabase/migrations/20261027000000_care_journeys.sql", "utf8");
const ROLLBACK = readFileSync("supabase/rollbacks/20261027000000_care_journeys.sql", "utf8");
let fam: Family;

beforeAll(async () => {
  fam = await createFamily(await createPerson("Journey Owner"), "Journey family", "Ari");
});

afterAll(() => pool.end());

describe("care journeys", () => {
  it("a new person starts in Little Steps", async () => {
    const { rows } = await pool.query("select journey from public.children where id = $1", [fam.childId]);
    expect(rows[0].journey).toBe("little_steps");
  });

  it("only the three journeys are allowed", async () => {
    expect(await errorCode(tryAs(fam.owner, (q) => q("update public.children set journey = 'other' where id = $1", [fam.childId])))).toBe("22P02");
  });

  it("only an owner or family can change a person's journey", async () => {
    const viewer = await addMember(fam, await createPerson("Journey Viewer"), { role: "viewer" });
    await tryAs(viewer, async (q) => {
      expect((await q("update public.children set journey = 'care_together' where id = $1", [fam.childId])).rowCount).toBe(0);
    });
    await tryAs(fam.owner, async (q) => {
      expect((await q("update public.children set journey = 'care_together' where id = $1", [fam.childId])).rowCount).toBe(1);
    });
  });
});

describe("the migration", () => {
  it("keeps every existing person and puts them all in Little Steps, and the rollback undoes it", async () => {
    const client = await pool.connect();
    try {
      // Everything here is rolled back at the end, so the test database is untouched.
      await client.query("begin");
      const before = await client.query("select id, family_id, name, birth_date, photo_path from public.children order by id");

      await client.query(ROLLBACK);
      const columns = await client.query(
        "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'children' and column_name = 'journey'",
      );
      expect(columns.rowCount).toBe(0);
      // A person added before journeys existed.
      await client.query("insert into public.children (family_id, name) values ($1, 'Before journeys')", [fam.id]);

      await client.query(MIGRATION);
      const after = await client.query("select id, family_id, name, birth_date, photo_path, journey from public.children order by id");
      expect(after.rowCount).toBe((before.rowCount ?? 0) + 1);
      expect(after.rows.every((r) => r.journey === "little_steps")).toBe(true);
      const unchanged = after.rows
        .filter((r) => r.name !== "Before journeys")
        .map((r) => ({ id: r.id, family_id: r.family_id, name: r.name, birth_date: r.birth_date, photo_path: r.photo_path }));
      expect(unchanged).toEqual(before.rows);
    } finally {
      await client.query("rollback");
      client.release();
    }
  });
});
