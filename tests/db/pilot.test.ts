import { readFileSync } from "node:fs";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RLS_DENIED, addMember, as, asVisitor, createFamily, createPerson, errorCode, pool, tryAs, type Family, type Person } from "./helpers";

// Ready for the pilot: invite-only sign-up with pilot codes, and feedback that
// only the JOSIA Care team can read. Turning invite only on would stop other
// test files creating families, so those tests run inside one transaction
// that is always rolled back.

let fam: Family;
let grandma: Person;
let nurse: Person;
let stranger: Person;

beforeAll(async () => {
  fam = await createFamily(await createPerson("Pilot Owner"), "Pilot Care Circle", "Noa");
  grandma = await addMember(fam, await createPerson("Pilot Grandma"), { role: "viewer" });
  nurse = await addMember(fam, await createPerson("Pilot Nurse"), { role: "helper", view: ["diary"], edit: ["diary"] });
  stranger = await createPerson("Pilot Stranger");
});

afterAll(() => pool.end());

/** Runs fn in a transaction that is rolled back, switching to a person with asPerson(). */
async function inRollback(fn: (client: pg.PoolClient, asPerson: (p: Person) => Promise<void>) => Promise<void>) {
  const client = await pool.connect();
  const asPerson = async (p: Person) => {
    await client.query("reset role");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: p.id, email: p.email, role: "authenticated" })]);
  };
  try {
    await client.query("begin");
    await fn(client, asPerson);
  } finally {
    await client.query("rollback");
    client.release();
  }
}

const tryQuery = async (client: pg.PoolClient, sql: string, params: unknown[] = []) => {
  await client.query("savepoint s");
  try {
    await client.query(sql, params);
    await client.query("release savepoint s");
    return "ok";
  } catch (error) {
    await client.query("rollback to savepoint s");
    return (error as { code?: string }).code ?? String(error);
  }
};

describe("invite-only sign-up", () => {
  it("is open until the operator turns it on, and the app can ask whether a code is needed", async () => {
    expect((await as(stranger, (q) => q("select public.signup_needs_code() as needs"))).rows[0].needs).toBe(false);
    expect(await errorCode(asVisitor((q) => q("select public.signup_needs_code()")))).toBe(RLS_DENIED);
  });

  it("needs a valid pilot code, used up after its uses, ignoring case and spaces", async () => {
    await inRollback(async (client, asPerson) => {
      await client.query("update private.signup set invite_only = true");
      await client.query("insert into private.pilot_codes (code_hash, label, uses_left) values (private.code_hash('JOSIAH-2026'), 'Test family', 1)");
      const parent = await createPerson("Pilot Parent");
      const other = await createPerson("Pilot Other Parent");

      await asPerson(parent);
      expect((await client.query("select public.signup_needs_code() as needs")).rows[0].needs).toBe(true);
      expect(await tryQuery(client, "select public.create_family('A', 'B')")).toBe("22023");
      expect(await tryQuery(client, "select public.create_family('A', 'B', null, 'America/New_York', 'WRONG')")).toBe("22023");
      expect(await tryQuery(client, "select public.create_family('A', 'B', null, 'America/New_York', ' josiah-2026 ')")).toBe("ok");

      await asPerson(other);
      expect(await tryQuery(client, "select public.create_family('C', 'D', null, 'America/New_York', 'JOSIAH-2026')")).toBe("22023");

      await client.query("reset role");
      expect((await client.query("select uses_left from private.pilot_codes")).rows[0].uses_left).toBe(0);
    });
  });

  it("never lets anyone in the app read the codes or change the setting", async () => {
    for (const sql of ["select * from private.pilot_codes", "select * from private.signup", "update private.signup set invite_only = false"]) {
      expect(await errorCode(tryAs(fam.owner, (q) => q(sql)))).toBe(RLS_DENIED);
    }
  });
});

describe("feedback", () => {
  it("anyone in the Care Circle can send it, and no one in the app can read it", async () => {
    for (const person of [fam.owner, grandma, nurse]) {
      await as(person, (q) => q("select public.send_feedback($1, $2, '/f/x')", [fam.id, `From ${person.name}`]));
    }
    const { rows } = await pool.query("select count(*)::int as n from private.feedback where family_id = $1", [fam.id]);
    expect(rows[0].n).toBe(3);
    expect(await errorCode(tryAs(fam.owner, (q) => q("select * from private.feedback")))).toBe(RLS_DENIED);
    // Not a care record, so it never reaches the owner's audit trail.
    const audit = await pool.query("select count(*)::int as n from public.audit_log where family_id = $1 and table_name = 'feedback'", [fam.id]);
    expect(audit.rows[0].n).toBe(0);
  });

  it("only from your own Care Circle, with words in it", async () => {
    expect(await errorCode(tryAs(stranger, (q) => q("select public.send_feedback($1, 'Hi')", [fam.id])))).toBe(RLS_DENIED);
    expect(await errorCode(tryAs(grandma, (q) => q("select public.send_feedback($1, '   ')", [fam.id])))).toBe("22023");
    expect(await errorCode(asVisitor((q) => q("select public.send_feedback($1, 'Hi')", [fam.id])))).toBe(RLS_DENIED);
  });

  it("at most 20 a day from one person", async () => {
    await tryAs(nurse, async (q) => {
      for (let i = 0; i < 19; i++) await q("select public.send_feedback($1, $2)", [fam.id, `Note ${i}`]);
      await q("savepoint s");
      expect(await errorCode(q("select public.send_feedback($1, 'One more')", [fam.id]))).toBe("22023");
    });
  });
});

describe("the migration", () => {
  it("keeps every family, and the rollback undoes it", async () => {
    const migration = readFileSync("supabase/migrations/20261029000000_pilot.sql", "utf8");
    const rollback = readFileSync("supabase/rollbacks/20261029000000_pilot.sql", "utf8");
    await inRollback(async (client) => {
      const before = (await client.query("select count(*)::int as n from public.families")).rows[0].n;
      await client.query(rollback);
      expect((await client.query("select to_regclass('private.feedback') as t")).rows[0].t).toBeNull();
      await client.query(migration);
      expect((await client.query("select count(*)::int as n from public.families")).rows[0].n).toBe(before);
      expect((await client.query("select invite_only from private.signup")).rows[0].invite_only).toBe(false);
    });
  });
});
