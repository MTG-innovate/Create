import { randomUUID } from "node:crypto";
import pg from "pg";

// Connects as the database superuser (to set up fixtures), then switches to
// the "authenticated" role with a JWT subject for each signed-in action, the
// same way Supabase's API runs queries for a signed-in person.
const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/postgres";
export const pool = new pg.Pool({ connectionString: url, max: 4 });

export type Person = { id: string; email: string; name: string };
type Query = (sql: string, params?: unknown[]) => Promise<pg.QueryResult>;

const run = Math.random().toString(36).slice(2, 8);

/** Creates a sign-in account. Every email is unique per test run. */
export async function createPerson(name: string): Promise<Person> {
  const email = `${name.toLowerCase().replace(/\W+/g, ".")}.${run}@example.test`;
  const { rows } = await pool.query(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3) returning id",
    [randomUUID(), email, { display_name: name }],
  );
  return { id: rows[0].id, email, name };
}

async function withRole<T>(person: Person | null, commit: boolean, fn: (q: Query) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${person ? "authenticated" : "anon"}`);
    if (person) {
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: person.id, email: person.email, role: "authenticated" }),
      ]);
    }
    const result = await fn((sql, params) => client.query(sql, params));
    await client.query(commit ? "commit" : "rollback");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/** Runs queries as this person and keeps the changes. */
export const as = <T>(person: Person, fn: (q: Query) => Promise<T>) => withRole(person, true, fn);

/** Runs queries as this person and throws the changes away. */
export const tryAs = <T>(person: Person, fn: (q: Query) => Promise<T>) => withRole(person, false, fn);

/** Runs queries as a signed-out visitor. */
export const asVisitor = <T>(fn: (q: Query) => Promise<T>) => withRole(null, false, fn);

/** The Postgres error code a promise rejects with, or "ok" if it succeeds. */
export async function errorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "ok";
  } catch (error) {
    return (error as { code?: string }).code ?? String(error);
  }
}

export const RLS_DENIED = "42501";

export type Family = { id: string; childId: string; owner: Person };

/** Creates a family the way the app does: the owner calls create_family(). */
export async function createFamily(owner: Person, familyName: string, childName: string): Promise<Family> {
  return as(owner, async (q) => {
    const { rows } = await q("select public.create_family($1, $2, '2025-06-01', 'America/New_York') as id", [
      familyName,
      childName,
    ]);
    const child = await q("select id from public.children where family_id = $1", [rows[0].id]);
    return { id: rows[0].id, childId: child.rows[0].id, owner };
  });
}

export type Invite = {
  role: "owner" | "family" | "helper" | "viewer";
  label?: string;
  view?: string[];
  edit?: string[];
};

/** Invites a person and has them accept, returning them as a member. */
export async function addMember(family: Family, person: Person, invite: Invite): Promise<Person> {
  const token = await createInvitation(family, person.email, invite);
  await as(person, (q) => q("select public.accept_invitation($1)", [token]));
  return person;
}

export async function createInvitation(family: Family, email: string, invite: Invite): Promise<string> {
  return as(family.owner, async (q) => {
    const { rows } = await q("select * from public.create_invitation($1, $2, $3, $4, $5, $6)", [
      family.id,
      email,
      invite.role,
      invite.label ?? null,
      invite.view ?? [],
      invite.edit ?? [],
    ]);
    return rows[0].token as string;
  });
}

/**
 * One sample row for each care table, as a column -> value map, for the given
 * family and child. Used to prove every table is walled off the same way.
 */
export function sampleRows(familyId: string, childId: string): Record<string, Record<string, unknown>> {
  return {
    visit_series: { family_id: familyId, child_id: childId, kind: "Physical therapy", starts_on: "2026-01-05" },
    visits: { family_id: familyId, child_id: childId, kind: "Cardiology", date: "2026-02-10", summary: "Heart sounds good" },
    moments: { family_id: familyId, child_id: childId, type: "meal", date: "2026-02-10", details: { amount: 3, unit: "oz" } },
    practice_items: { family_id: familyId, child_id: childId, instruction: "Tummy time, 5 minutes" },
    medicines: { family_id: familyId, child_id: childId, name: "Iron drops", dose: "0.5 ml" },
    team_contacts: { family_id: familyId, name: "Pat Example, RN", phone: "555-0100" },
    wins: { family_id: familyId, child_id: childId, title: "Finished a whole bottle", happened_on: "2026-02-10" },
    questions: { family_id: familyId, child_id: childId, text: "Can we stop the night feed?" },
    supplies: { family_id: familyId, child_id: childId, name: "Feeding pump bags", category: "Supply", reorder_days: 30 },
  };
}

export const CARE_TABLES = Object.keys(sampleRows("", ""));

/** Inserts a row as this person and returns its id. */
export async function insertRow(q: Query, table: string, row: Record<string, unknown>): Promise<string> {
  const cols = Object.keys(row);
  const values = cols.map((c) => (row[c] !== null && typeof row[c] === "object" ? JSON.stringify(row[c]) : row[c]));
  const { rows } = await q(
    `insert into public.${table} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
    values,
  );
  return rows[0].id;
}
