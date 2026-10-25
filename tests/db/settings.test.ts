import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMember, as, createFamily, createPerson, errorCode, pool, tryAs, type Family } from "./helpers";

let rivera: Family;
let okafor: Family;

beforeAll(async () => {
  rivera = await createFamily(await createPerson("Settings Rivera"), "The Riveras", "Mateo");
  okafor = await createFamily(await createPerson("Settings Okafor"), "The Okafors", "Ada");
});

afterAll(() => pool.end());

const setPhoto = (f: Family, path: string) =>
  tryAs(f.owner, (q) => q("update public.children set photo_path = $1 where id = $2", [path, f.childId]));

describe("a child's photo", () => {
  it("can point inside the child's own folder", async () => {
    expect(await errorCode(setPhoto(rivera, `${rivera.id}/${rivera.childId}/photo-1.jpg`))).toBe("ok");
  });

  it("can never point at another family's or another child's file", async () => {
    expect(await errorCode(setPhoto(okafor, `${rivera.id}/${rivera.childId}/photo-1.jpg`))).toBe("23514");
    expect(await errorCode(setPhoto(okafor, `${okafor.id}/${rivera.childId}/photo-1.jpg`))).toBe("23514");
    expect(await errorCode(setPhoto(okafor, "photo-1.jpg"))).toBe("23514");
  });
});

describe("settings", () => {
  it("family can change the feeding unit and encouragement; helpers and viewers cannot", async () => {
    const dad = await addMember(rivera, await createPerson("Settings Dad"), { role: "family" });
    const viewer = await addMember(rivera, await createPerson("Settings Viewer"), { role: "viewer" });
    const nurse = await addMember(rivera, await createPerson("Settings Nurse"), { role: "helper", view: ["diary"], edit: ["diary"] });
    await as(dad, (q) => q("update public.families set feed_unit = 'ml', encouragement = 'gentle' where id = $1", [rivera.id]));
    const { rows } = await pool.query("select feed_unit, encouragement from public.families where id = $1", [rivera.id]);
    expect(rows[0]).toEqual({ feed_unit: "ml", encouragement: "gentle" });
    for (const p of [viewer, nurse]) {
      const r = await tryAs(p, (q) => q("update public.families set feed_unit = 'oz' where id = $1", [rivera.id]));
      expect(r.rowCount).toBe(0);
    }
  });

  it("a brother or sister can be added by family, and gets the same protection", async () => {
    const { rows } = await as(rivera.owner, (q) =>
      q("insert into public.children (family_id, name) values ($1, 'Sofia') returning id", [rivera.id]),
    );
    const seen = await tryAs(okafor.owner, (q) => q("select 1 from public.children where id = $1", [rows[0].id]));
    expect(seen.rowCount).toBe(0);
  });
});
