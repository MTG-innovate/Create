import { expect, test } from "@playwright/test";
import { shots, signIn } from "./helpers";

// Everything for Josiah's day: corrected age, medicine times, the emergency
// card, pumping, and equipment and supplies. All of it invented.

test("a due date shows Josiah's corrected age on Home", async ({ browser }) => {
  const parent = await signIn(browser, "parent@example.com");
  const home = parent.url();
  await parent.goto(home + "/settings");
  const form = parent.locator("form", { has: parent.getByLabel("Due date") });
  await form.getByLabel("Due date").fill("2025-06-21");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByText("Saved")).toBeVisible();

  await parent.goto(home);
  await expect(parent.getByText(/corrected$/)).toBeVisible();
});

test("medicine times become Medicines today, and grandma sees who gave a dose", async ({ browser }) => {
  const parent = await signIn(browser, "parent@example.com");
  await parent.getByRole("link", { name: "Care Circle", exact: true }).click();
  await parent.getByRole("link", { name: "+ Medicine" }).click();
  await parent.getByLabel("Medicine *").fill("Vitamin D drops");
  await parent.getByLabel("Dose").fill("1 ml");
  await parent.getByLabel("Times of day, 1").fill("08:00");
  await parent.getByLabel("Times of day, 2").fill("20:00");
  await parent.getByRole("button", { name: "Save" }).click();
  await expect(parent.getByRole("link", { name: "Vitamin D drops 1 ml · 8:00 AM, 8:00 PM" }).first()).toBeVisible();

  const grandma = await signIn(browser, "grandma@example.com");
  await expect(grandma.getByRole("heading", { name: "Medicines today" })).toBeVisible();
  await parent.getByRole("link", { name: "Home", exact: true }).click();
  await parent.getByRole("checkbox", { name: "Vitamin D drops at 8:00 AM" }).first().check();
  await expect(parent.getByText(/given by you/).first()).toBeVisible();
  await expect(grandma.getByText(/given by Josiah's parent/).first()).toBeVisible({ timeout: 10_000 });
  await expect(parent.getByText("never by AI")).toBeVisible();
  await parent.screenshot({ path: `${shots}/16-medicines-today.png`, fullPage: true });
});

test("the emergency card gathers allergies, the plan and the hospital; a helper can read it", async ({ browser }) => {
  const parent = await signIn(browser, "parent@example.com");
  await parent.getByRole("link", { name: "Care Circle", exact: true }).click();
  await parent.getByRole("link", { name: /Josiah’s emergency card/ }).click();
  await expect(parent.getByRole("link", { name: "Call 911" })).toBeVisible();
  // The form starts open while the card is empty.
  const fill = parent.locator("details", { hasText: "Fill in Josiah’s card" });
  if (!(await fill.evaluate((d: HTMLDetailsElement) => d.open))) await fill.getByText("Fill in Josiah’s card").click();
  await parent.getByLabel("Allergies").fill("None known");
  await parent.getByLabel("If something happens").fill("Call 911 first, then the parent.");
  await parent.getByLabel("Preferred hospital").fill("Example Children's Hospital");
  await parent.getByRole("button", { name: "Save" }).click();

  const card = parent.getByRole("article", { name: "Emergency card" });
  await expect(card.getByText("None known")).toBeVisible();
  await expect(card.getByText("Example Children's Hospital")).toBeVisible();
  await expect(parent.getByRole("button", { name: "Copy card" })).toBeVisible();
  await parent.screenshot({ path: `${shots}/17-emergency-card.png`, fullPage: true });

  const nurse = await signIn(browser, "nurse@example.com");
  await nurse.goto(nurse.url() + "/card");
  await expect(nurse.getByRole("article", { name: "Emergency card" }).getByText("Call 911 first, then the parent.")).toBeVisible();
  await expect(nurse.getByText("Fill in Josiah’s card")).toHaveCount(0);
});

test("a pumping session shows a Pumped tile", async ({ browser }) => {
  const parent = await signIn(browser, "parent@example.com");
  await parent.getByRole("link", { name: "Diary", exact: true }).click();
  await expect(parent.getByRole("heading", { name: "Josiah’s diary" })).toBeVisible();
  await parent.getByRole("button", { name: "Add a moment" }).click();
  await parent.getByRole("dialog").getByRole("link", { name: "Pumping" }).click();
  await parent.getByLabel("Amount pumped").fill("3");
  await parent.getByLabel("Side").selectOption("Both");
  await parent.getByRole("button", { name: "Save" }).click();

  await expect(parent).toHaveURL(/\/diary/);
  await expect(parent.getByRole("link", { name: /^Pumped: \d/ })).toBeVisible();
});

test("equipment and supplies, with a gentle reorder reminder", async ({ browser }) => {
  const parent = await signIn(browser, "parent@example.com");
  await parent.getByRole("link", { name: "Care Circle", exact: true }).click();
  await parent.getByRole("link", { name: "+ Supply" }).click();
  await parent.getByLabel("What it is *").fill("Pump extension sets");
  await parent.getByLabel("Reorder").selectOption("Every month");
  await parent.getByLabel("Last ordered").fill("2025-01-01");
  await parent.getByRole("button", { name: "Save" }).click();

  await expect(parent.getByRole("link", { name: /Pump extension sets/ }).first()).toBeVisible();
  await expect(parent.getByText("Time to reorder").first()).toBeVisible();
});
