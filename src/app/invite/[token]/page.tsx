import Link from "next/link";
import { ROLE_LABEL, type Role } from "@/lib/access";
import { getUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "./join-form";

type Preview = { family_name: string | null; child_names: string[] | null; role: Role | null; helper_label: string | null; for_this_email: boolean };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const user = await getUser();

  if (!user) {
    return (
      <Shell title="You have been invited">
        <p>Someone invited you to their Care Circle on JOSIA Care. Sign in with the email address the invitation was sent to.</p>
        <div className="actions">
          <Link className="btn primary" href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`}>
            Sign in to join
          </Link>
        </div>
      </Shell>
    );
  }

  const supabase = await createClient();
  const [{ data }, { data: profile }] = await Promise.all([
    supabase.rpc("invitation_preview", { invitation_token: token }).maybeSingle<Preview>(),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);

  if (!data) {
    return (
      <Shell title="This link has expired">
        <p>Invitation links work once and last 14 days. Ask the person who invited you to send a new one.</p>
      </Shell>
    );
  }
  if (!data.for_this_email) {
    return (
      <Shell title="This invitation is for someone else">
        <p>
          You are signed in as <b>{user.email}</b>, but this link was sent to a different email address. Sign out and
          sign in with the address the invitation went to.
        </p>
        <form action="/auth/sign-out" method="post">
          <button className="btn" type="submit">
            Sign out
          </button>
        </form>
      </Shell>
    );
  }

  const kids = data.child_names?.join(" and ") || "your little one";
  const as = data.role === "helper" ? data.helper_label || "a helper" : ROLE_LABEL[data.role!].toLowerCase();
  return (
    <Shell title={`Join ${data.family_name}`}>
      <p>
        You are invited to help care for {kids} as <b>{as}</b>.
      </p>
      <JoinForm token={token} yourName={profile?.display_name ?? ""} />
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="band">
      <div className="inner stack">
        <section className="card pad">
          <p className="eyebrow">JOSIA Care</p>
          <h1>{title}</h1>
          {children}
        </section>
      </div>
    </main>
  );
}
