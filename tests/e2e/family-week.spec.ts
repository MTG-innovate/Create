import { expect, test, type Browser, type Page } from "@playwright/test";

// The brief's "done means": two people in one family see the same week
// within seconds. Uses the invented demo family from supabase/seed.sql.

const MAIL = "http://127.0.0.1:54324";
const shots = "test-results/screens";

/** Signs in with an emailed link, the way a real person would. */
async function signIn(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const since = Date.now();
  await page.goto("/sign-in");
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.goto(await signInLink(email, since));
  await expect(page).toHaveURL(/\/f\/[0-9a-f-]{36}$/);
  return page;
}

async function signInLink(email: string, since: number): Promise<string> {
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

const todayInNewYork = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );

test("a weekly visit added by a parent appears on grandma's week within seconds", async ({ browser }) => {
  const parent = await signIn(browser, "parent@example.com");
  const grandma = await signIn(browser, "grandma@example.com");

  await expect(parent.getByRole("heading", { name: "Josiah", level: 1 })).toBeVisible();
  await expect(grandma.getByRole("heading", { name: "This week" })).toBeVisible();
  await expect(grandma.getByText("No visits today. A good day for cuddles and rest.")).toBeVisible();
  await parent.screenshot({ path: `${shots}/1-home-empty.png`, fullPage: true });

  // Parent adds physical therapy every week for 4 weeks, starting today.
  await parent.getByRole("link", { name: "Visits", exact: true }).click();
  await parent.getByRole("link", { name: "+ Visit" }).click();
  await parent.getByLabel("Type").selectOption("Physical therapy");
  await parent.getByLabel("What is it").fill("PT with Ms. Rivera");
  await parent.getByLabel("Date *").fill(todayInNewYork());
  await parent.getByLabel("Time").fill("23:30");
  await parent.getByLabel("Location").fill("Home");
  await parent.getByLabel("Repeat").selectOption("4");
  await parent.screenshot({ path: `${shots}/2-new-visit.png`, fullPage: true });
  await parent.getByRole("button", { name: "Save" }).click();

  // Four weekly dates from one rule.
  await expect(parent).toHaveURL(/\/visits$/);
  await expect(parent.getByRole("link", { name: /PT with Ms\. Rivera/ })).toHaveCount(4);
  await parent.screenshot({ path: `${shots}/3-visits-list.png`, fullPage: true });

  // Grandma's Home updates by itself.
  await expect(grandma.getByRole("link", { name: /PT with Ms\. Rivera/ })).toBeVisible({ timeout: 10_000 });
  await expect(grandma.getByText("11:30 PM")).toBeVisible();
  await grandma.screenshot({ path: `${shots}/4-grandma-home.png`, fullPage: true });

  // Notes on just this week stay with this week.
  await parent.getByRole("link", { name: /PT with Ms\. Rivera/ }).first().click();
  await parent.getByLabel("What happened at the visit").fill("Rolled from tummy to back twice!");
  await parent.getByRole("button", { name: "Save" }).click();
  await expect(parent).toHaveURL(/\/visits$/);
  await expect(parent.getByText("Rolled from tummy to back twice!")).toHaveCount(1);

  // Stopping the series from the second week keeps the first, with its notes.
  await parent.getByRole("link", { name: /PT with Ms\. Rivera/ }).nth(1).click();
  const stop = parent.getByRole("button", { name: "Stop the weekly visits from here" });
  await stop.click();
  await parent.getByRole("button", { name: "Tap again to confirm" }).click();
  await expect(parent).toHaveURL(/\/visits$/);
  await expect(parent.getByRole("link", { name: /PT with Ms\. Rivera/ })).toHaveCount(1);
  await expect(parent.getByText("Rolled from tummy to back twice!")).toBeVisible();
});

test("a helper who can see visits but not change them gets no add or save buttons", async ({ browser }) => {
  const nurse = await signIn(browser, "nurse@example.com");
  await expect(nurse.getByRole("heading", { name: "This week" })).toBeVisible();
  await expect(nurse.getByRole("link", { name: "+ Add a visit" })).toHaveCount(0);
  await nurse.getByRole("link", { name: "Visits", exact: true }).click();
  await expect(nurse.getByRole("link", { name: "+ Visit" })).toHaveCount(0);
  await nurse.screenshot({ path: `${shots}/5-nurse-visits.png`, fullPage: true });
});
