import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CARE_TABLES,
  RLS_DENIED,
  addMember,
  as,
  asVisitor,
  createFamily,
  createPerson,
  errorCode,
  insertRow,
  pool,
  sampleRows,
  tryAs,
  type Family,
  type Person,
} from "./helpers";

// Two invented families. Nothing one family stores may be visible to, or
// changeable by, the other.
let rivera: Family;
let okafor: Family;
let both: Person; // a grandparent who belongs to both families
const riveraRows: Record<string, string> = {};

beforeAll(async () => {
  rivera = await createFamily(await createPerson("Lucia Rivera"), "The Riveras", "Mateo");
  okafor = await createFamily(await createPerson("Chidi Okafor"), "The Okafors", "Ada");
  both = await createPerson("Grace Both");
  await addMember(rivera, both, { role: "family" });
  await addMember(okafor, both, { role: "family" });

  const rows = sampleRows(rivera.id, rivera.childId);
  await as(rivera.owner, async (q) => {
    for (const table of CARE_TABLES) riveraRows[table] = await insertRow(q, table, rows[table]);
  });
});

afterAll(() => pool.end());

describe("one family cannot see another", () => {
  it.each(CARE_TABLES)("%s rows are invisible to the other family", async (table) => {
    const seen = await tryAs(okafor.owner, (q) => q(`select id from public.${table}`));
    expect(seen.rows.map((r) => r.id)).not.toContain(riveraRows[table]);
    expect(seen.rowCount).toBe(0);
  });

  it("the family, its child, its members and its audit trail are invisible", async () => {
    await tryAs(okafor.owner, async (q) => {
      for (const [table, column] of [
        ["families", "id"],
        ["children", "family_id"],
        ["family_members", "family_id"],
        ["invitations", "family_id"],
        ["audit_log", "family_id"],
      ]) {
        const { rowCount } = await q(`select 1 from public.${table} where ${column} = $1`, [rivera.id]);
        expect(rowCount, table).toBe(0);
      }
    });
  });

  it("people's names are visible only to people who share a family with them", async () => {
    const seen = await tryAs(okafor.owner, (q) => q("select id from public.profiles"));
    const ids = seen.rows.map((r) => r.id);
    expect(ids).toContain(okafor.owner.id);
    expect(ids).toContain(both.id);
    expect(ids).not.toContain(rivera.owner.id);
  });
});

describe("one family cannot change another", () => {
  it.each(CARE_TABLES)("%s rows cannot be updated or deleted by the other family", async (table) => {
    await tryAs(okafor.owner, async (q) => {
      const updated = await q(`update public.${table} set updated_at = now() where id = $1`, [riveraRows[table]]);
      const deleted = await q(`delete from public.${table} where id = $1`, [riveraRows[table]]);
      expect(updated.rowCount).toBe(0);
      expect(deleted.rowCount).toBe(0);
    });
    const still = await pool.query(`select 1 from public.${table} where id = $1`, [riveraRows[table]]);
    expect(still.rowCount).toBe(1);
  });

  it.each(CARE_TABLES)("%s rows cannot be added to the other family", async (table) => {
    const row = sampleRows(rivera.id, rivera.childId)[table];
    expect(await errorCode(tryAs(okafor.owner, (q) => insertRow(q, table, row)))).toBe(RLS_DENIED);
  });

  it("a record cannot point at another family's child", async () => {
    // Okafor's own family, Rivera's child: the composite key rejects it.
    const row = sampleRows(okafor.id, rivera.childId).moments;
    expect(await errorCode(tryAs(okafor.owner, (q) => insertRow(q, "moments", row)))).toBe("23503");
  });

  it("settings, children and memberships of the other family cannot be changed", async () => {
    await tryAs(okafor.owner, async (q) => {
      expect((await q("update public.families set name = 'Taken' where id = $1", [rivera.id])).rowCount).toBe(0);
      expect((await q("update public.children set name = 'Taken' where family_id = $1", [rivera.id])).rowCount).toBe(0);
      expect((await q("delete from public.family_members where family_id = $1", [rivera.id])).rowCount).toBe(0);
    });
    expect(
      await errorCode(tryAs(okafor.owner, (q) => q("insert into public.children (family_id, name) values ($1, 'Intruder')", [rivera.id]))),
    ).toBe(RLS_DENIED);
  });

  it("the other family's owner cannot invite people into it or delete its child", async () => {
    expect(
      await errorCode(
        tryAs(okafor.owner, (q) => q("select * from public.create_invitation($1, 'x@example.test', 'family')", [rivera.id])),
      ),
    ).toBe(RLS_DENIED);
    expect(await errorCode(tryAs(okafor.owner, (q) => q("select public.delete_child($1)", [rivera.childId])))).toBe(RLS_DENIED);
  });

  it("someone in both families cannot move a record from one to the other", async () => {
    const code = await errorCode(
      tryAs(both, (q) =>
        q("update public.team_contacts set family_id = $1 where id = $2", [okafor.id, riveraRows.team_contacts]),
      ),
    );
    expect(code).toBe(RLS_DENIED);
  });

  it("someone in both families sees each family's records only under that family", async () => {
    const { rows } = await tryAs(both, (q) => q("select family_id from public.team_contacts where id = $1", [riveraRows.team_contacts]));
    expect(rows).toEqual([{ family_id: rivera.id }]);
  });
});

describe("table-wide commands", () => {
  it.each([...CARE_TABLES, "families", "children", "family_members", "profiles", "invitations", "audit_log"])(
    "%s cannot be emptied with TRUNCATE, which ignores row level security",
    async (table) => {
      expect(await errorCode(tryAs(okafor.owner, (q) => q(`truncate public.${table} cascade`)))).toBe(RLS_DENIED);
    },
  );
});

describe("signed-out visitors", () => {
  it.each([...CARE_TABLES, "families", "children", "family_members", "profiles", "invitations", "audit_log"])(
    "cannot read %s",
    async (table) => {
      expect(await errorCode(asVisitor((q) => q(`select 1 from public.${table}`)))).toBe(RLS_DENIED);
    },
  );

  it("cannot call any family function", async () => {
    expect(await errorCode(asVisitor((q) => q("select public.create_family('x', 'y')")))).toBe(RLS_DENIED);
    expect(await errorCode(asVisitor((q) => q("select public.accept_invitation('x')")))).toBe(RLS_DENIED);
  });
});
