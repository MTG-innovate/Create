import { ActionForm } from "@/components/action-form";
import { AREA_LABEL, ROLE_LABEL } from "@/lib/access";
import { getFamily } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Invitation, Member } from "@/lib/types";
import { AccessFields } from "./access-fields";
import { cancelInvitation, changeMember, removeMember } from "./actions";
import { InviteForm } from "./forms";
import styles from "./people.module.css";

export default async function PeoplePage({ params }: PageProps<"/f/[familyId]/people">) {
  const { familyId } = await params;
  const { family, children, me, user } = await getFamily(familyId);
  const isOwner = me.role === "owner";
  const childName = children[0]?.name ?? "your little one";

  const { members, nameOf, emailOf, pending } = await loadPeople(family.id);

  const describe = (m: Pick<Member, "role" | "helper_label" | "view_areas" | "edit_areas">) =>
    m.role === "helper"
      ? [
          m.helper_label || "Helper",
          m.edit_areas.length ? `Adds to: ${m.edit_areas.map((a) => AREA_LABEL[a].split(":")[0]).join(", ")}` : "",
          `Sees: ${m.view_areas.map((a) => AREA_LABEL[a].split(":")[0]).join(", ")}`,
        ]
          .filter(Boolean)
          .join(" · ")
      : ROLE_LABEL[m.role];

  return (
    <>
      <section>
        <h1>{childName}&rsquo;s people</h1>
        <p className="muted">Everyone who helps {childName} grow, and what each person can see.</p>
      </section>

      <section>
        <h2>In this Care Circle</h2>
        <div className="card list">
          {members.map((m) => {
            const isMe = m.user_id === user.id;
            const name = nameOf.get(m.user_id) || emailOf.get(m.user_id) || "Someone in the Care Circle";
            return (
              <div key={m.user_id} className="row">
                <div className="main">
                  <div className="title">
                    {name}
                    {isMe ? " (you)" : ""}
                  </div>
                  <div className="sub">{describe(m)}</div>
                  {isOwner && !isMe ? (
                    <details className={styles.member}>
                      <summary>Change or remove</summary>
                      <div className={styles.edit}>
                        <ActionForm action={changeMember} submit="Save" pendingLabel="Saving…">
                          <input type="hidden" name="familyId" value={family.id} />
                          <input type="hidden" name="userId" value={m.user_id} />
                          <AccessFields
                            idPrefix={`m-${m.user_id}`}
                            role={m.role}
                            helperLabel={m.helper_label}
                            view={m.view_areas}
                            edit={m.edit_areas}
                          />
                        </ActionForm>
                        <ActionForm
                          action={removeMember}
                          submit={`Remove ${name} from the Care Circle`}
                          confirm="Tap again to remove"
                          pendingLabel="Removing…"
                          danger
                        >
                          <input type="hidden" name="familyId" value={family.id} />
                          <input type="hidden" name="userId" value={m.user_id} />
                        </ActionForm>
                      </div>
                    </details>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {isOwner ? (
        <section>
          <h2>Invite someone</h2>
          <InviteForm familyId={family.id} />
        </section>
      ) : null}

      {isOwner && pending.length ? (
        <section>
          <h2>Waiting to join</h2>
          <div className="card list">
            {pending.map((i) => (
              <div key={i.id} className="row">
                <div className="main">
                  <div className="title">{i.email}</div>
                  <div className="sub">
                    {describe(i)} · Link expires {new Date(i.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                </div>
                <ActionForm action={cancelInvitation} submit="Cancel" confirm="Tap again" pendingLabel="Cancelling…" danger>
                  <input type="hidden" name="familyId" value={family.id} />
                  <input type="hidden" name="invitationId" value={i.id} />
                </ActionForm>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <ActionForm action={removeMember} submit="Leave this Care Circle" confirm="Tap again to leave" pendingLabel="Leaving…" danger>
          <input type="hidden" name="familyId" value={family.id} />
          <input type="hidden" name="userId" value={user.id} />
        </ActionForm>
      </section>
    </>
  );
}

async function loadPeople(familyId: string) {
  const supabase = await createClient();
  const { data: memberRows } = await supabase.from("family_members").select("*").eq("family_id", familyId).order("created_at");
  const members = (memberRows ?? []) as Member[];
  const [{ data: profiles }, { data: invitationRows }] = await Promise.all([
    supabase.from("profiles").select("id, display_name").in("id", members.map((m) => m.user_id)),
    // Only owners get rows back; the database hides invitations from everyone else.
    supabase.from("invitations").select("*").eq("family_id", familyId).order("created_at", { ascending: false }),
  ]);
  const invitations = (invitationRows ?? []) as (Invitation & { accepted_by: string | null })[];
  const now = Date.now();
  return {
    members,
    nameOf: new Map((profiles ?? []).map((p) => [p.id, p.display_name as string])),
    emailOf: new Map(invitations.filter((i) => i.accepted_by).map((i) => [i.accepted_by!, i.email])),
    pending: invitations.filter((i) => !i.accepted_at && !i.revoked_at && Date.parse(i.expires_at) > now),
  };
}
