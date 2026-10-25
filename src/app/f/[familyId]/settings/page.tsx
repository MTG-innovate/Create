import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { canEdit, canView } from "@/lib/access";
import { photoUrls } from "@/lib/photos";
import { getFamily } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { addChild, deleteChildData, removePhoto, saveChild, saveFamilySettings } from "./actions";
import { PhotoPicker } from "./photo-picker";
import { Reminders, type MyDevice } from "./reminders";

export default async function SettingsPage({ params, searchParams }: PageProps<"/f/[familyId]/settings">) {
  const { familyId } = await params;
  const { deleted } = await searchParams;
  const { family, children, me } = await getFamily(familyId);
  // Settings change the family and the children, which owners and family can do.
  const editable = me.role === "owner" || me.role === "family";
  const photos = await photoUrls(children);
  const remindable = canView(me, "visits") || canView(me, "diary");
  const devices = remindable ? await myDevices(family.id) : [];

  return (
    <>
      <h1>Settings</h1>
      {deleted ? (
        <p className="banner" role="status">
          That child&rsquo;s data has been permanently deleted.
        </p>
      ) : null}

      {children.map((child) => (
        <section key={child.id} className="card pad">
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <span
              style={{
                width: 72, height: 72, borderRadius: "50%", overflow: "hidden", flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
                background: "linear-gradient(135deg, var(--hero1), var(--hero2))", color: "var(--accent-text)", fontFamily: "var(--display)", fontSize: "1.8rem", boxShadow: "0 0 0 3px var(--ring)",
              }}
            >
              {photos.get(child.id) ? (
                // eslint-disable-next-line @next/next/no-img-element -- a short-lived private link, not a static asset
                <img src={photos.get(child.id)} alt={`${child.name}'s photo`} width={72} height={72} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
              ) : (
                child.name[0]?.toUpperCase()
              )}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <h2>{child.name}</h2>
              {editable ? (
                <div className="actions">
                  <PhotoPicker familyId={family.id} childId={child.id} childName={child.name} hasPhoto={Boolean(child.photo_path)} />
                  {child.photo_path ? (
                    <ActionForm action={removePhoto} submit="Remove photo" pendingLabel="Removing…" plain>
                      <input type="hidden" name="familyId" value={family.id} />
                      <input type="hidden" name="childId" value={child.id} />
                    </ActionForm>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          {editable ? (
            <ActionForm action={saveChild} submit="Save" pendingLabel="Saving…">
              <input type="hidden" name="familyId" value={family.id} />
              <input type="hidden" name="childId" value={child.id} />
              <div className="field half">
                <label htmlFor={`name-${child.id}`}>Name</label>
                <input id={`name-${child.id}`} name="name" defaultValue={child.name} required maxLength={60} />
              </div>
              <div className="field half">
                <label htmlFor={`birth-${child.id}`}>Birthday</label>
                <input id={`birth-${child.id}`} name="birthDate" type="date" defaultValue={child.birth_date ?? ""} />
              </div>
              <div className="field half">
                <label htmlFor={`due-${child.id}`}>Due date</label>
                <input id={`due-${child.id}`} name="dueDate" type="date" defaultValue={child.due_date ?? ""} />
              </div>
              <p className="muted small" style={{ flexBasis: "100%" }}>
                If {child.name} came early, the due date lets Home show {child.name}&rsquo;s corrected age, which doctors and therapists use until age 2 or 3.
              </p>
            </ActionForm>
          ) : null}
        </section>
      ))}

      {remindable ? (
        <Reminders
          familyId={family.id}
          childName={children[0]?.name ?? "your little one"}
          devices={devices}
          vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null}
          visits={canView(me, "visits")}
          nightFeed={canEdit(me, "diary")}
        />
      ) : null}

      <section className="card pad">
        <h2>For the whole Care Circle</h2>
        {editable ? (
          <ActionForm action={saveFamilySettings} submit="Save" pendingLabel="Saving…">
            <input type="hidden" name="familyId" value={family.id} />
            <div className="field half">
              <label htmlFor="feedUnit">Feeding amounts in</label>
              <select id="feedUnit" name="feedUnit" defaultValue={family.feed_unit}>
                <option value="oz">Ounces (oz)</option>
                <option value="ml">Milliliters (ml)</option>
              </select>
            </div>
            <div className="field half">
              <label htmlFor="encouragement">Daily encouragement</label>
              <select id="encouragement" name="encouragement" defaultValue={family.encouragement}>
                <option value="scripture">Scripture</option>
                <option value="gentle">Gentle words</option>
              </select>
            </div>
          </ActionForm>
        ) : (
          <p className="muted">
            Feeding amounts in {family.feed_unit === "ml" ? "milliliters" : "ounces"}. Daily encouragement: {family.encouragement === "scripture" ? "Scripture" : "gentle words"}.
          </p>
        )}
      </section>

      {canEdit(me, "diary") && editable ? (
        <details className="card pad">
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Add a brother or sister</summary>
          <ActionForm action={addChild} submit="Add" pendingLabel="Adding…">
            <input type="hidden" name="familyId" value={family.id} />
            <div className="field half">
              <label htmlFor="new-name">Name</label>
              <input id="new-name" name="name" required maxLength={60} />
            </div>
            <div className="field half">
              <label htmlFor="new-birth">Birthday</label>
              <input id="new-birth" name="birthDate" type="date" />
            </div>
          </ActionForm>
        </details>
      ) : null}

      <section className="card list">
        <Link className="row" href={`/f/${family.id}/people`} style={{ textDecoration: "none", color: "var(--ink)" }}>
          <span className="main">
            <span className="title" style={{ display: "block" }}>
              Who can see the tracker
            </span>
            <span className="sub">Invite family and helpers, and choose what each person sees</span>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
      </section>

      {me.role === "owner" ? (
        <section className="card pad">
          <h2>Your Care Circle&rsquo;s data</h2>
          <p className="muted">Download everything added to this Care Circle, as a file you can keep. Photos are not included.</p>
          <div className="actions">
            <a className="btn small" href={`/f/${family.id}/export`} download>
              Download everything
            </a>
          </div>
          {children.map((child) => (
            <details key={child.id}>
              <summary style={{ cursor: "pointer", color: "var(--danger)", fontWeight: 700, padding: "8px 0" }}>
                Delete {child.name}&rsquo;s data permanently
              </summary>
              <p className="muted small">
                This removes every visit, diary moment, weigh in, win, medicine and photo for {child.name}, and their history. It cannot be undone. Download everything first if you want to keep a copy.
              </p>
              <ActionForm action={deleteChildData} submit={`Delete ${child.name}'s data`} confirm="Tap again to delete forever" pendingLabel="Deleting…" danger>
                <input type="hidden" name="familyId" value={family.id} />
                <input type="hidden" name="childId" value={child.id} />
                <div className="field">
                  <label htmlFor={`confirm-${child.id}`}>Type {child.name}&rsquo;s name to confirm</label>
                  <input id={`confirm-${child.id}`} name="confirm" autoComplete="off" required />
                </div>
              </ActionForm>
            </details>
          ))}
        </section>
      ) : null}
    </>
  );
}

/** This person's phones with reminders on for this family. The database shows no one else's. */
async function myDevices(familyId: string): Promise<MyDevice[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("push_devices")
    .select("id, endpoint, visit_evening, visit_soon, night_feed, night_feed_at")
    .eq("family_id", familyId);
  return data ?? [];
}
