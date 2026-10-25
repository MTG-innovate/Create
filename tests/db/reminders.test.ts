import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  RLS_DENIED,
  addMember,
  as,
  asVisitor,
  createFamily,
  createPerson,
  errorCode,
  pool,
  tryAs,
  type Family,
  type Person,
} from "./helpers";

// Step 8: reminders on each person's phone. Phones are personal settings, so
// each person sees only their own, and the reminder sender's secret can read
// only what reminders need.

const SECRET = "test-reminder-secret";
let rivera: Family;
let okafor: Family;
let dad: Person;
let grandma: Person;
let nurse: Person;
let visitor: Person;

const phone = (family: Family, n: number) => ({
  family_id: family.id,
  endpoint: `https://push.example.test/${family.id}/${n}`,
  p256dh: `key-${n}`,
  auth_key: `auth-${n}`,
});

async function addPhone(person: Person, family: Family, n: number): Promise<string> {
  const p = phone(family, n);
  return as(person, async (q) => {
    const { rows } = await q(
      "insert into public.push_devices (family_id, user_id, endpoint, p256dh, auth_key) values ($1, $2, $3, $4, $5) returning id",
      [p.family_id, person.id, p.endpoint, p.p256dh, p.auth_key],
    );
    return rows[0].id;
  });
}

beforeAll(async () => {
  rivera = await createFamily(await createPerson("Lucia Rivera"), "The Riveras", "Mateo");
  okafor = await createFamily(await createPerson("Chidi Okafor"), "The Okafors", "Ada");
  dad = await addMember(rivera, await createPerson("Rivera Dad"), { role: "family" });
  grandma = await addMember(rivera, await createPerson("Rivera Grandma"), { role: "viewer" });
  nurse = await addMember(rivera, await createPerson("Rivera Nurse"), { role: "helper", view: ["visits", "diary"], edit: ["diary"] });
  visitor = await addMember(rivera, await createPerson("Rivera Speech"), { role: "helper", view: ["practice"], edit: [] });
  await pool.query("insert into private.reminder_sender (secret_hash) values (sha256(convert_to($1, 'UTF8'))) on conflict do nothing", [SECRET]);
});

afterAll(() => pool.end());

describe("a person's phones", () => {
  it("are seen and changed only by that person", async () => {
    const id = await addPhone(dad, rivera, 1);
    await tryAs(rivera.owner, async (q) => {
      expect((await q("select 1 from public.push_devices where id = $1", [id])).rowCount).toBe(0);
      expect((await q("update public.push_devices set night_feed = true where id = $1", [id])).rowCount).toBe(0);
      expect((await q("delete from public.push_devices where id = $1", [id])).rowCount).toBe(0);
    });
    await tryAs(dad, async (q) => {
      expect((await q("select 1 from public.push_devices where id = $1", [id])).rowCount).toBe(1);
      expect((await q("update public.push_devices set night_feed = true, night_feed_at = '22:30' where id = $1", [id])).rowCount).toBe(1);
    });
  });

  it("are invisible to another family", async () => {
    const id = await addPhone(rivera.owner, rivera, 2);
    await tryAs(okafor.owner, async (q) => {
      expect((await q("select 1 from public.push_devices where id = $1", [id])).rowCount).toBe(0);
    });
  });

  it("cannot be added for someone else, or to a family the person is not in", async () => {
    const p = phone(rivera, 3);
    expect(
      await errorCode(
        tryAs(dad, (q) =>
          q("insert into public.push_devices (family_id, user_id, endpoint, p256dh, auth_key) values ($1, $2, $3, $4, $5)", [
            p.family_id, grandma.id, p.endpoint, p.p256dh, p.auth_key,
          ]),
        ),
      ),
    ).toBe(RLS_DENIED);
    expect(await errorCode(addPhone(okafor.owner, rivera, 4))).toBe(RLS_DENIED);
  });

  it("need something to be reminded about: a helper who sees neither visits nor the diary cannot add one", async () => {
    expect(await errorCode(addPhone(grandma, rivera, 5))).toBe("ok");
    expect(await errorCode(addPhone(nurse, rivera, 6))).toBe("ok");
    expect(await errorCode(addPhone(visitor, rivera, 7))).toBe(RLS_DENIED);
  });

  it("cannot be moved to another family or pointed at another push address", async () => {
    const id = await addPhone(dad, rivera, 8);
    expect(await errorCode(tryAs(dad, (q) => q("update public.push_devices set family_id = $1 where id = $2", [okafor.id, id])))).toBe(RLS_DENIED);
    expect(await errorCode(tryAs(dad, (q) => q("update public.push_devices set endpoint = 'https://evil.example.test' where id = $1", [id])))).toBe(
      RLS_DENIED,
    );
  });

  it("leave the audit trail without their push address or keys", async () => {
    const id = await addPhone(dad, rivera, 9);
    const { rows } = await pool.query("select new_data from public.audit_log where record_id = $1", [id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].new_data).toMatchObject({ user_id: dad.id, visit_evening: true });
    expect(Object.keys(rows[0].new_data)).not.toEqual(expect.arrayContaining(["endpoint"]));
    expect(JSON.stringify(rows[0].new_data)).not.toMatch(/push\.example|key-9|auth-9/);
  });

  it("go when the person leaves the family", async () => {
    const leaver = await addMember(rivera, await createPerson("Rivera Cousin"), { role: "family" });
    const id = await addPhone(leaver, rivera, 10);
    await as(rivera.owner, (q) => q("delete from public.family_members where family_id = $1 and user_id = $2", [rivera.id, leaver.id]));
    expect((await pool.query("select 1 from public.push_devices where id = $1", [id])).rowCount).toBe(0);
  });
});

describe("the reminder sender", () => {
  it("needs the secret", async () => {
    for (const sql of ["select public.reminder_data($1)", "select * from public.claim_reminders($1, '[]')", "select public.forget_push_devices($1, '{}')"]) {
      expect(await errorCode(asVisitor((q) => q(sql, ["wrong"]))), sql).toBe(RLS_DENIED);
      expect(await errorCode(tryAs(rivera.owner, (q) => q(sql, [null]))), sql).toBe(RLS_DENIED);
    }
  });

  it("reads what reminders need, without push addresses or notes", async () => {
    await as(rivera.owner, (q) =>
      q("insert into public.visits (family_id, child_id, kind, date, time, notes) values ($1, $2, 'Cardiology', (now() at time zone 'America/New_York')::date + 1, '10:30', 'Secret note')", [
        rivera.id,
        rivera.childId,
      ]),
    );
    const { rows } = await asVisitor((q) => q("select public.reminder_data($1) as data", [SECRET]));
    const fam = rows[0].data.find((f: { id: string }) => f.id === rivera.id);
    expect(fam.children).toEqual([{ id: rivera.childId, name: "Mateo" }]);
    expect(fam.visits).toEqual([expect.objectContaining({ kind: "Cardiology", time: "10:30", cancelled: false })]);
    expect(fam.devices.length).toBeGreaterThan(0);
    const text = JSON.stringify(rows[0].data);
    expect(text).not.toMatch(/push\.example|Secret note|auth-/);
    // A family with no phones is left out.
    expect(rows[0].data.some((f: { id: string }) => f.id === okafor.id)).toBe(false);
  });

  it("claims each reminder once, and only then gets the push address", async () => {
    const id = await addPhone(dad, rivera, 11);
    const claim = JSON.stringify([{ device_id: id, key: "evening:2026-03-01" }]);
    const first = await as(dad, () => pool.query("select * from public.claim_reminders($1, $2)", [SECRET, claim]));
    expect(first.rows).toEqual([{ device_id: id, key: "evening:2026-03-01", endpoint: phone(rivera, 11).endpoint, p256dh: "key-11", auth_key: "auth-11" }]);
    const again = await pool.query("select * from public.claim_reminders($1, $2)", [SECRET, claim]);
    expect(again.rows).toEqual([]);
  });

  it("forgets phones that are gone", async () => {
    const id = await addPhone(dad, rivera, 12);
    await pool.query("select public.forget_push_devices($1, $2)", [SECRET, [id]]);
    expect((await pool.query("select 1 from public.push_devices where id = $1", [id])).rowCount).toBe(0);
  });

  it("is not stored anywhere a person can read", async () => {
    for (const table of ["private.reminder_sender", "private.reminders_sent"]) {
      expect(await errorCode(tryAs(rivera.owner, (q) => q(`select * from ${table}`))), table).toBe(RLS_DENIED);
    }
  });
});
