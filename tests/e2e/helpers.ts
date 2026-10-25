import { expect, type Browser, type Page } from "@playwright/test";

// Shared by the end-to-end tests. They use the invented demo family from
// supabase/seed.sql and read sign-in emails from the local mail viewer.

const MAIL = "http://127.0.0.1:54324";
export const shots = "test-results/screens";

/** Signs in with an emailed link, the way a real person would. */
export async function signIn(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  // Show the app's own warnings (such as live updates failing to connect) in the test output.
  page.on("console", (m) => {
    if (m.type() === "warning" || m.type() === "error") console.log(`[${email}] ${m.text()}`);
  });
  const since = Date.now();
  await page.goto("/sign-in");
  await page.getByLabel("Your email").fill(email);
  // Auth sends one link per address a second; signing the same person in twice
  // in a row can get "Too many tries", so wait and ask again, as a person would.
  for (let attempt = 1; ; attempt++) {
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    const sent = page.getByRole("heading", { name: "Check your email" });
    await expect(sent.or(page.getByText("Too many tries"))).toBeVisible();
    if (await sent.isVisible()) break;
    if (attempt === 3) await expect(sent).toBeVisible();
    await page.waitForTimeout(2000);
  }
  await page.goto(await signInLink(email, since));
  await expect(page).toHaveURL(/\/f\/[0-9a-f-]{36}$/);
  return page;
}

export async function signInLink(email: string, since: number): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages = [] } = (await res.json()) as { messages?: { ID: string; Created: string }[] };
    const fresh = messages.find((m) => Date.parse(m.Created) >= since - 2000);
    if (fresh) {
      const message = (await (await fetch(`${MAIL}/api/v1/message/${fresh.ID}`)).json()) as { HTML: string; Text: string };
      const link = (message.HTML + message.Text).match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]+/);
      if (link) return link[0].replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No sign-in email arrived for ${email}`);
}

export const todayInNewYork = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
