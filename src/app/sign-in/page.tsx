import { safeNext } from "@/lib/errors";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const next = safeNext(params.next);
  return (
    <main className="band">
      <div className="inner stack">
        <section>
          <p className="eyebrow">Little Steps</p>
          <h1>Welcome</h1>
        </section>
        {params.error ? (
          <p className="banner" role="alert">
            That sign-in link has expired or was already used. Here is a fresh one.
          </p>
        ) : null}
        <SignInForm next={next} />
      </div>
    </main>
  );
}
