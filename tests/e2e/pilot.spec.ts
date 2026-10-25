import { expect, test } from "@playwright/test";
import { shots, signIn } from "./helpers";

// Ready for the pilot: privacy and terms anyone can read, a Getting started
// checklist for the owner, and feedback that goes to the JOSIA Care team.

test("privacy and terms are plain, public and linked from sign in", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { name: "Privacy", level: 1 })).toBeVisible();
  await expect(page.getByText("We do not sell your information")).toBeVisible();
  await expect(page.getByText(/not set up as a HIPAA-covered service/)).toBeVisible();
  await page.getByRole("link", { name: "Terms" }).click();
  await expect(page.getByRole("heading", { name: "Terms", level: 1 })).toBeVisible();
  await expect(page.getByText("In an emergency, call 911.")).toBeVisible();
});

test("the owner gets a Getting started checklist on Home; family members do not", async ({ browser }) => {
  const parent = await signIn(browser, "parent@example.com");
  const start = parent.locator("section", { has: parent.getByRole("heading", { name: "Getting started" }) });
  await expect(start).toBeVisible();
  // The demo family already has Josiah's birthday, a grandparent and a nurse.
  await expect(start.getByText("Add Josiah's birthday and due date (done)")).toBeVisible();
  await expect(start.getByText("Invite someone to Josiah's Care Circle (done)")).toBeVisible();
  await expect(start.getByRole("link", { name: /Turn on reminders on your phone/ })).toBeVisible();
  await parent.screenshot({ path: `${shots}/18-getting-started.png`, fullPage: true });

  await start.getByRole("button", { name: "Hide this" }).click();
  await expect(start).toHaveCount(0);
  await parent.reload();
  await expect(parent.getByRole("heading", { name: "Getting started" })).toHaveCount(0);

  const grandma = await signIn(browser, "grandma@example.com");
  await expect(grandma.getByRole("heading", { name: "Getting started" })).toHaveCount(0);
});

test("anyone in the Care Circle can send feedback to the JOSIA Care team", async ({ browser }) => {
  const nurse = await signIn(browser, "nurse@example.com");
  await nurse.getByRole("link", { name: "Care Circle", exact: true }).click();
  await nurse.getByRole("link", { name: /Send us feedback/ }).click();
  await expect(nurse.getByText("not to anyone in your Care Circle")).toBeVisible();
  await nurse.getByLabel("Your note").fill("It would help to see last night's feed before my visit.");
  await nurse.getByRole("button", { name: "Send" }).click();
  await expect(nurse.getByText("Sent. Thank you, we read every note.")).toBeVisible();
});
