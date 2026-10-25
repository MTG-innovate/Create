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
let dad: Person; // Family
let grandma: Person; // Viewer
let nurse: Person; // Helper: home nurse
let therapist: Person; // Helper: physical therapist

beforeAll(async () => {
  fam = await createFamily(await createPerson("Jordan Example"), "Josiah's family", "Josiah");
  dad = await addMember(fam, await createPerson("Sam Example"), { role: "family" });
  grandma = await addMember(fam, await createPerson("Nana Example"), { role: "viewer" });
  nurse = await addMember(fam, await createPerson("Nurse Example"), {
    role: "helper",
    label: "Home nurse",
    view: ["visits", "diary", "nurse_notes", "growth", "practice", "medicines", "team"],
    edit: ["diary", "nurse_notes", "growth", "practice"],
  });
  therapist = await addMember(fam, await createPerson("Therapist Example"), {
    role: "helper",
    label: "Physical therapist",
    view: ["visits", "practice"],
    edit: ["visits", "practice"],
  });
});

afterAll(() => pool.end());

const rows = () => sampleRows(fam.id, fam.childId);
const moment = (type: string) => ({ family_id: fam.id, child_id: fam.childId, type, date: "2026-03-01" });

describe("Family", () => {
  it("can add, change and delete records someone else added", async () => {
    for (const table of CARE_TABLES) {
      const id = await as(fam.owner, (q) => insertRow(q, table, rows()[table]));
      await tryAs(dad, async (q) => {
        expect((await q(`update public.${table} set updated_at = now() where id = $1`, [id])).rowCount, table).toBe(1);
        expect((await q(`delete from public.${table} where id = $1`, [id])).rowCount, table).toBe(1);
      });
      expect(await errorCode(tryAs(dad, (q) => insertRow(q, table, rows()[table]))), table).toBe("ok");
    }
  });

  it("can change family settings and the child's details", async () => {
    await tryAs(dad, async (q) => {
      expect((await q("update public.families set feed_unit = 'ml' where id = $1", [fam.id])).rowCount).toBe(1);
      expect((await q("update public.children set birth_date = '2025-06-02' where id = $1", [fam.childId])).rowCount).toBe(1);
    });
  });

  it("cannot invite people, change roles, remove people, read the audit trail or delete the child", async () => {
    expect(
      await errorCode(tryAs(dad, (q) => q("select * from public.create_invitation($1, 'new@example.test', 'viewer')", [fam.id]))),
    ).toBe(RLS_DENIED);
    await tryAs(dad, async (q) => {
      expect((await q("update public.family_members set role = 'viewer' where user_id = $1", [grandma.id])).rowCount).toBe(0);
      expect((await q("delete from public.family_members where user_id = $1", [grandma.id])).rowCount).toBe(0);
      expect((await q("select 1 from public.audit_log")).rowCount).toBe(0);
      expect((await q("select 1 from public.invitations")).rowCount).toBe(0);
    });
    expect(await errorCode(tryAs(dad, (q) => q("select public.delete_child($1)", [fam.childId])))).toBe(RLS_DENIED);
  });
});

describe("Viewer", () => {
  it("can read every care record", async () => {
    const ids = await as(fam.owner, async (q) => {
      const out: Record<string, string> = {};
      for (const table of CARE_TABLES) out[table] = await insertRow(q, table, rows()[table]);
      return out;
    });
    await tryAs(grandma, async (q) => {
      for (const table of CARE_TABLES) {
        expect((await q(`select 1 from public.${table} where id = $1`, [ids[table]])).rowCount, table).toBe(1);
      }
    });
  });

  it("cannot add, change or delete anything", async () => {
    for (const table of CARE_TABLES) {
      expect(await errorCode(tryAs(grandma, (q) => insertRow(q, table, rows()[table]))), table).toBe(RLS_DENIED);
      await tryAs(grandma, async (q) => {
        expect((await q(`update public.${table} set updated_at = now()`)).rowCount, table).toBe(0);
        expect((await q(`delete from public.${table}`)).rowCount, table).toBe(0);
      });
    }
    await tryAs(grandma, async (q) => {
      expect((await q("update public.families set feed_unit = 'ml'")).rowCount).toBe(0);
      expect((await q("update public.children set name = 'X'")).rowCount).toBe(0);
    });
  });
});

describe("Helpers see and update only their own tasks", () => {
  it("a nurse can add meals, nurse notes and weigh ins", async () => {
    for (const type of ["meal", "night_feed", "medicine_given", "nurse_note", "weigh_in"]) {
      expect(await errorCode(tryAs(nurse, (q) => insertRow(q, "moments", moment(type)))), type).toBe("ok");
    }
  });

  it("a nurse can see the medicine list but not change it", async () => {
    const id = await as(fam.owner, (q) => insertRow(q, "medicines", rows().medicines));
    await tryAs(nurse, async (q) => {
      expect((await q("select 1 from public.medicines where id = $1", [id])).rowCount).toBe(1);
      expect((await q("update public.medicines set dose = '5 ml' where id = $1", [id])).rowCount).toBe(0);
    });
    expect(await errorCode(tryAs(nurse, (q) => insertRow(q, "medicines", rows().medicines)))).toBe(RLS_DENIED);
  });

  it("a nurse cannot see wins or questions", async () => {
    await as(fam.owner, async (q) => {
      await insertRow(q, "wins", rows().wins);
      await insertRow(q, "questions", rows().questions);
    });
    await tryAs(nurse, async (q) => {
      expect((await q("select 1 from public.wins")).rowCount).toBe(0);
      expect((await q("select 1 from public.questions")).rowCount).toBe(0);
    });
  });

  it("a therapist sees visits and practice, but not the diary, nurse notes or medicines", async () => {
    await as(fam.owner, async (q) => {
      await insertRow(q, "moments", moment("meal"));
      await insertRow(q, "moments", moment("nurse_note"));
      await insertRow(q, "medicines", rows().medicines);
      await insertRow(q, "visits", rows().visits);
    });
    await tryAs(therapist, async (q) => {
      expect((await q("select 1 from public.moments")).rowCount).toBe(0);
      expect((await q("select 1 from public.medicines")).rowCount).toBe(0);
      expect((await q("select 1 from public.team_contacts")).rowCount).toBe(0);
      expect((await q("select 1 from public.visits")).rowCount).toBeGreaterThan(0);
    });
    expect(await errorCode(tryAs(therapist, (q) => insertRow(q, "practice_items", rows().practice_items)))).toBe("ok");
    expect(await errorCode(tryAs(therapist, (q) => insertRow(q, "moments", moment("meal"))))).toBe(RLS_DENIED);
  });

  it("a helper cannot turn a moment into a kind they are not allowed to add", async () => {
    // The nurse can edit both the diary and nurse notes, so this is allowed.
    const id = await as(nurse, (q) => insertRow(q, "moments", moment("meal")));
    const ok = await tryAs(nurse, (q) => q("update public.moments set type = 'nurse_note' where id = $1", [id]));
    expect(ok.rowCount).toBe(1);
    // A helper who can edit the diary but not growth cannot relabel a meal as a weigh in.
    const diaryOnly = await addMember(fam, await createPerson("Sitter Example"), {
      role: "helper",
      label: "Sitter",
      view: ["diary"],
      edit: ["diary"],
    });
    const mealId = await as(diaryOnly, (q) => insertRow(q, "moments", moment("meal")));
    expect(
      await errorCode(tryAs(diaryOnly, (q) => q("update public.moments set type = 'weigh_in' where id = $1", [mealId]))),
    ).toBe(RLS_DENIED);
  });

  it("a helper can delete only what they added themselves", async () => {
    const own = await as(nurse, (q) => insertRow(q, "moments", moment("diaper")));
    const others = await as(fam.owner, (q) => insertRow(q, "moments", moment("diaper")));
    await tryAs(nurse, async (q) => {
      expect((await q("delete from public.moments where id = $1", [others])).rowCount).toBe(0);
      expect((await q("delete from public.moments where id = $1", [own])).rowCount).toBe(1);
    });
  });

  it("a helper's 'done by' check on home practice is recorded as theirs", async () => {
    const item = await as(fam.owner, (q) => insertRow(q, "practice_items", rows().practice_items));
    const check = await as(nurse, (q) =>
      insertRow(q, "practice_checks", { family_id: fam.id, child_id: fam.childId, practice_item_id: item, done_on: "2026-03-01" }),
    );
    const { rows: found } = await pool.query("select created_by from public.practice_checks where id = $1", [check]);
    expect(found[0].created_by).toBe(nurse.id);
  });

  it("a helper cannot change family settings or the child's details", async () => {
    await tryAs(nurse, async (q) => {
      expect((await q("update public.families set feed_unit = 'ml'")).rowCount).toBe(0);
      expect((await q("update public.children set name = 'X'")).rowCount).toBe(0);
    });
  });
});

describe("Owners", () => {
  it("can change a helper's areas, and other roles never carry areas", async () => {
    await tryAs(fam.owner, async (q) => {
      await q("update public.family_members set view_areas = '{visits}', edit_areas = '{}' where user_id = $1", [therapist.id]);
      await q("update public.family_members set role = 'family' where user_id = $1", [nurse.id]);
      const { rows: m } = await q("select view_areas, edit_areas from public.family_members where user_id = $1", [nurse.id]);
      expect(m[0]).toEqual({ view_areas: "{}", edit_areas: "{}" });
    });
  });

  it("cannot leave a family without an owner, but a second owner makes that possible", async () => {
    const solo = await createFamily(await createPerson("Solo Owner"), "Solo", "Kai");
    expect(
      await errorCode(tryAs(solo.owner, (q) => q("delete from public.family_members where user_id = $1", [solo.owner.id]))),
    ).toBe("23514");
    expect(
      await errorCode(
        tryAs(solo.owner, (q) => q("update public.family_members set role = 'family' where user_id = $1", [solo.owner.id])),
      ),
    ).toBe("23514");

    const partner = await addMember(solo, await createPerson("Second Owner"), { role: "owner" });
    expect(partner).toBeTruthy();
    expect(
      await errorCode(tryAs(solo.owner, (q) => q("delete from public.family_members where user_id = $1", [solo.owner.id]))),
    ).toBe("ok");
  });

  it("anyone can leave a family themselves", async () => {
    const res = await tryAs(grandma, (q) => q("delete from public.family_members where user_id = $1", [grandma.id]));
    expect(res.rowCount).toBe(1);
  });
});
