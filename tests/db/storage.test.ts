import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RLS_DENIED, addMember, as, createFamily, createPerson, errorCode, pool, tryAs, type Family, type Person } from "./helpers";

let rivera: Family;
let okafor: Family;
let viewer: Person;
let photo: string;

beforeAll(async () => {
  rivera = await createFamily(await createPerson("Photo Rivera"), "The Riveras", "Mateo");
  okafor = await createFamily(await createPerson("Photo Okafor"), "The Okafors", "Ada");
  viewer = await addMember(rivera, await createPerson("Photo Viewer"), { role: "viewer" });
  photo = `${rivera.id}/${rivera.childId}/photo.jpg`;
  await as(rivera.owner, (q) => q("insert into storage.objects (bucket_id, name) values ('child-photos', $1)", [photo]));
});

afterAll(() => pool.end());

const upload = (name: string) => (q: (sql: string, p?: unknown[]) => Promise<unknown>) =>
  q("insert into storage.objects (bucket_id, name) values ('child-photos', $1)", [name]);

describe("children's photos", () => {
  it("the bucket is private", async () => {
    const { rows } = await pool.query("select public from storage.buckets where id = 'child-photos'");
    expect(rows[0].public).toBe(false);
  });

  it("are visible to the family, including viewers", async () => {
    expect((await tryAs(viewer, (q) => q("select 1 from storage.objects where name = $1", [photo]))).rowCount).toBe(1);
  });

  it("are invisible to other families", async () => {
    expect((await tryAs(okafor.owner, (q) => q("select 1 from storage.objects where name = $1", [photo]))).rowCount).toBe(0);
  });

  it("cannot be added, replaced or removed by another family", async () => {
    expect(await errorCode(tryAs(okafor.owner, upload(`${rivera.id}/${rivera.childId}/swap.jpg`)))).toBe(RLS_DENIED);
    await tryAs(okafor.owner, async (q) => {
      expect((await q("update storage.objects set name = name where name = $1", [photo])).rowCount).toBe(0);
    });
    // Real Supabase refuses every direct delete on its storage tables (deletes go
    // through the Storage API, which applies these same policies); plain
    // Postgres applies the policy and deletes nothing. Either way it must fail.
    const removal = tryAs(okafor.owner, (q) => q("delete from storage.objects where name = $1", [photo]));
    const outcome = await removal.then((r) => r.rowCount, (e: { code?: string }) => e.code);
    expect([0, RLS_DENIED]).toContain(outcome);
    expect((await pool.query("select 1 from storage.objects where name = $1", [photo])).rowCount).toBe(1);
  });

  it("cannot be added by viewers, or outside a family folder", async () => {
    expect(await errorCode(tryAs(viewer, upload(`${rivera.id}/${rivera.childId}/new.jpg`)))).toBe(RLS_DENIED);
    expect(await errorCode(tryAs(rivera.owner, upload("loose.jpg")))).toBe(RLS_DENIED);
  });
});
