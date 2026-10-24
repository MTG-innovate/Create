import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  RLS_DENIED,
  as,
  createFamily,
  createInvitation,
  createPerson,
  errorCode,
  pool,
  tryAs,
  type Family,
} from "./helpers";

let fam: Family;

beforeAll(async () => {
  fam = await createFamily(await createPerson("Invite Owner"), "Josiah's family", "Josiah");
});

afterAll(() => pool.end());

const accept = (person: Parameters<typeof as>[0], token: string) =>
  as(person, (q) => q("select public.accept_invitation($1) as family_id", [token]));

describe("invitations", () => {
  it("joins the family with the role and areas the owner chose", async () => {
    const nurse = await createPerson("Invited Nurse");
    const token = await createInvitation(fam, nurse.email.toUpperCase(), {
      role: "helper",
      label: "Home nurse",
      view: ["diary", "nurse_notes"],
      edit: ["nurse_notes"],
    });
    const { rows } = await accept(nurse, token);
    expect(rows[0].family_id).toBe(fam.id);

    const member = await pool.query("select * from public.family_members where family_id = $1 and user_id = $2", [fam.id, nurse.id]);
    expect(member.rows[0]).toMatchObject({
      role: "helper",
      helper_label: "Home nurse",
      view_areas: "{diary,nurse_notes}",
      edit_areas: "{nurse_notes}",
      invited_by: fam.owner.id,
    });
  });

  it("stores only a hash of the link token", async () => {
    const token = await createInvitation(fam, "hash.check@example.test", { role: "viewer" });
    const { rows } = await pool.query("select token_hash::text as h from public.invitations where email = 'hash.check@example.test'");
    expect(rows[0].h).not.toContain(token);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("works once, then the link is no longer valid", async () => {
    const grandpa = await createPerson("Invited Grandpa");
    const token = await createInvitation(fam, grandpa.email, { role: "family" });
    await accept(grandpa, token);
    expect(await errorCode(accept(grandpa, token))).toBe("ok"); // a double tap is harmless

    const someoneElse = await createPerson("Link Finder");
    expect(await errorCode(accept(someoneElse, token))).toBe("22023");
  });

  it("only works for the email address it was sent to", async () => {
    const token = await createInvitation(fam, "intended@example.test", { role: "family" });
    const wrong = await createPerson("Wrong Person");
    expect(await errorCode(accept(wrong, token))).toBe(RLS_DENIED);
    const member = await pool.query("select 1 from public.family_members where user_id = $1", [wrong.id]);
    expect(member.rowCount).toBe(0);
  });

  it("does not work after it expires", async () => {
    const late = await createPerson("Late Aunt");
    const token = await createInvitation(fam, late.email, { role: "viewer" });
    await pool.query("update public.invitations set expires_at = now() - interval '1 minute' where email = $1", [late.email]);
    expect(await errorCode(accept(late, token))).toBe("22023");
  });

  it("does not work after the owner cancels it", async () => {
    const cousin = await createPerson("Cancelled Cousin");
    const token = await createInvitation(fam, cousin.email, { role: "viewer" });
    const { rows } = await pool.query("select id from public.invitations where email = $1", [cousin.email]);
    await as(fam.owner, (q) => q("select public.revoke_invitation($1)", [rows[0].id]));
    expect(await errorCode(accept(cousin, token))).toBe("22023");
  });

  it("a new invitation to the same address replaces the old one", async () => {
    const uncle = await createPerson("Twice Invited");
    const first = await createInvitation(fam, uncle.email, { role: "viewer" });
    const second = await createInvitation(fam, uncle.email, { role: "family" });
    expect(await errorCode(accept(uncle, first))).toBe("22023");
    await accept(uncle, second);
    const member = await pool.query("select role from public.family_members where user_id = $1", [uncle.id]);
    expect(member.rows[0].role).toBe("family");
  });

  it("a made-up token does nothing", async () => {
    const guesser = await createPerson("Guesser");
    expect(await errorCode(accept(guesser, "0".repeat(64)))).toBe("22023");
    expect(await errorCode(accept(guesser, ""))).toBe("22023");
  });

  it("helpers must be given at least one area, and can only edit what they can see", async () => {
    expect(await errorCode(createInvitation(fam, "empty.helper@example.test", { role: "helper", view: [], edit: [] }))).toBe("23514");
    expect(
      await errorCode(createInvitation(fam, "odd.helper@example.test", { role: "helper", view: ["visits"], edit: ["medicines"] })),
    ).toBe("23514");
  });

  it("someone already in the family cannot be invited again", async () => {
    expect(await errorCode(createInvitation(fam, fam.owner.email, { role: "viewer" }))).toBe("23505");
  });

  it("the invite page names the family only to the person it was sent to", async () => {
    const aunt = await createPerson("Preview Aunt");
    const token = await createInvitation(fam, aunt.email, { role: "family" });
    const preview = (p: Parameters<typeof as>[0], t: string) =>
      tryAs(p, (q) => q("select * from public.invitation_preview($1)", [t]));

    expect((await preview(aunt, token)).rows).toEqual([
      { family_name: "Josiah's family", child_names: ["Josiah"], role: "family", helper_label: null, for_this_email: true },
    ]);
    const stranger = await createPerson("Preview Stranger");
    expect((await preview(stranger, token)).rows).toEqual([
      { family_name: null, child_names: null, role: null, helper_label: null, for_this_email: false },
    ]);
    expect((await preview(stranger, "f".repeat(64))).rows).toEqual([]);
  });

  it("only owners can see pending invitations", async () => {
    const helper = await createPerson("Curious Helper");
    await accept(helper, await createInvitation(fam, helper.email, { role: "helper", view: ["visits"] }));
    const seen = await tryAs(helper, (q) => q("select 1 from public.invitations"));
    expect(seen.rowCount).toBe(0);
    const ownerSees = await tryAs(fam.owner, (q) => q("select 1 from public.invitations"));
    expect(ownerSees.rowCount).toBeGreaterThan(0);
  });
});
