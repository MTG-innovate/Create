import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CARE_TABLES,
  RLS_DENIED,
  addMember,
  as,
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

let fam: Family;
let dad: Person;

beforeAll(async () => {
  fam = await createFamily(await createPerson("Audit Owner"), "Josiah's family", "Josiah");
  dad = await addMember(fam, await createPerson("Audit Dad"), { role: "family" });
});

afterAll(() => pool.end());

const trail = (recordId: string) =>
  pool.query("select action, actor, old_data, new_data from public.audit_log where record_id = $1 order by id", [recordId]);

describe("audit trail", () => {
  it("records who added, changed and deleted each record", async () => {
    const id = await as(fam.owner, (q) => insertRow(q, "medicines", sampleRows(fam.id, fam.childId).medicines));
    await as(dad, (q) => q("update public.medicines set dose = '1 ml' where id = $1", [id]));
    await as(dad, (q) => q("delete from public.medicines where id = $1", [id]));

    const { rows } = await trail(id);
    expect(rows.map((r) => [r.action, r.actor])).toEqual([
      ["insert", fam.owner.id],
      ["update", dad.id],
      ["delete", dad.id],
    ]);
    expect(rows[1].old_data.dose).toBe("0.5 ml");
    expect(rows[1].new_data.dose).toBe("1 ml");
  });

  it("stamps the real author even if the app sends a different one", async () => {
    const row = { ...sampleRows(fam.id, fam.childId).wins, created_by: fam.owner.id };
    const id = await as(dad, (q) => insertRow(q, "wins", row));
    const { rows } = await pool.query("select created_by from public.wins where id = $1", [id]);
    expect(rows[0].created_by).toBe(dad.id);
  });

  it("covers every care table", async () => {
    const ids = await as(fam.owner, async (q) => {
      const out: string[] = [];
      for (const table of CARE_TABLES) out.push(await insertRow(q, table, sampleRows(fam.id, fam.childId)[table]));
      return out;
    });
    for (const id of ids) expect((await trail(id)).rowCount).toBe(1);
  });

  it("cannot be read by non-owners, or edited by anyone", async () => {
    expect((await tryAs(dad, (q) => q("select 1 from public.audit_log"))).rowCount).toBe(0);
    expect((await tryAs(fam.owner, (q) => q("select 1 from public.audit_log"))).rowCount).toBeGreaterThan(0);
    for (const sql of ["delete from public.audit_log", "update public.audit_log set actor = null"]) {
      expect(await errorCode(tryAs(fam.owner, (q) => q(sql)))).toBe(RLS_DENIED);
    }
  });
});

describe("deleting a child's data", () => {
  it("removes every record about the child and its history, leaving only a note that it happened", async () => {
    const family = await createFamily(await createPerson("Purge Owner"), "Purge family", "Noa");
    const sibling = await as(family.owner, async (q) => {
      for (const table of CARE_TABLES) await insertRow(q, table, sampleRows(family.id, family.childId)[table]);
      const { rows } = await q("insert into public.children (family_id, name) values ($1, 'Twin') returning id", [family.id]);
      await insertRow(q, "wins", sampleRows(family.id, rows[0].id).wins);
      return rows[0].id as string;
    });

    await as(family.owner, (q) => q("select public.delete_child($1)", [family.childId]));

    for (const table of CARE_TABLES.filter((t) => t !== "team_contacts")) {
      const left = await pool.query(`select 1 from public.${table} where child_id = $1`, [family.childId]);
      expect(left.rowCount, table).toBe(0);
    }
    const history = await pool.query(
      "select action, child_id, old_data, new_data from public.audit_log where child_id = $1 or record_id = $1",
      [family.childId],
    );
    expect(history.rows).toEqual([{ action: "purge", child_id: null, old_data: null, new_data: null }]);

    // The twin and the shared care team are untouched.
    expect((await pool.query("select 1 from public.wins where child_id = $1", [sibling])).rowCount).toBe(1);
    expect((await pool.query("select 1 from public.team_contacts where family_id = $1", [family.id])).rowCount).toBe(1);
  });

  it("only an owner can do it, and only through delete_child", async () => {
    expect(await errorCode(tryAs(dad, (q) => q("select public.delete_child($1)", [fam.childId])))).toBe(RLS_DENIED);
    const direct = tryAs(fam.owner, (q) => q("delete from public.children where id = $1", [fam.childId]));
    expect(await errorCode(direct)).toBe(RLS_DENIED);
  });
});
