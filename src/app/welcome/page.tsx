import Link from "next/link";
import { getMyFamilies, requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { LegalLinks } from "@/components/legal-links";
import { WelcomeForm } from "./welcome-form";

export default async function WelcomePage() {
  const user = await requireUser("/welcome");
  const supabase = await createClient();
  const [{ data: profile }, families, { data: needsCode }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    getMyFamilies(),
    supabase.rpc("signup_needs_code"),
  ]);

  return (
    <main className="band">
      <div className="inner stack">
        <section>
          <p className="eyebrow">Welcome to JOSIA Care</p>
          <h1>Who are we caring for?</h1>
          <p className="muted">Start with your little one. You can add a brother or sister later.</p>
        </section>
        <WelcomeForm yourName={profile?.display_name ?? ""} needsCode={needsCode === true} />
        {families.length ? (
          <p className="small">
            <Link href={`/f/${families[0].id}`}>Back to {families[0].name}</Link>
          </p>
        ) : null}
        <LegalLinks />
      </div>
    </main>
  );
}
