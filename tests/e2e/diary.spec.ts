import { expect, test } from "@playwright/test";
import { shots, signIn } from "./helpers";

// Step 3: diary moments and the Home tiles, with the invented demo family.

test("a meal and a diaper logged by a parent update grandma's tiles within seconds", async ({ browser }) => {
  const parent = await signIn(browser, "parent@example.com");
  const grandma = await signIn(browser, "grandma@example.com");

  await expect(grandma.getByRole("heading", { name: "Josiah’s day so far" })).toBeVisible();
  // Meals may show the nurse's total from earlier tests until someone logs a meal.
  await expect(grandma.getByRole("link", { name: /^Meals: / })).toBeVisible();

  // Tapping the Meals tile adds a meal.
  await parent.getByRole("link", { name: /^Meals: / }).click();
  await parent.getByLabel("Amount").fill("3");
  await parent.getByLabel("How Josiah ate").selectOption("Bottle");
  await parent.screenshot({ path: `${shots}/6-new-meal.png`, fullPage: true });
  await parent.getByRole("button", { name: "Save" }).click();
  await expect(parent.getByRole("link", { name: /^Meals: 3 oz/ })).toBeVisible();

  // The plus button opens "Add a moment".
  await parent.getByRole("button", { name: "Add a moment" }).click();
  await parent.getByRole("dialog").getByRole("link", { name: "Diaper" }).click();
  await parent.getByLabel("Type").selectOption("Both");
  await parent.getByRole("button", { name: "Save" }).click();
  await expect(parent.getByText("1 wet, 1 dirty")).toBeVisible();
  await parent.screenshot({ path: `${shots}/7-home-tiles.png`, fullPage: true });

  // Grandma's Home catches up by itself.
  await expect(grandma.getByRole("link", { name: /^Meals: 3 oz/ })).toBeVisible({ timeout: 10_000 });
  await expect(grandma.getByText("1 wet, 1 dirty")).toBeVisible({ timeout: 10_000 });
});

test("a night feed's total is worked out from the pump rate and the times", async ({ browser }) => {
  const parent = await signIn(browser, "parent@example.com");
  await parent.getByRole("link", { name: "Diary", exact: true }).click();
  await expect(parent.getByRole("heading", { name: "Josiah’s diary" })).toBeVisible();
  await parent.getByRole("button", { name: "Add a moment" }).click();
  await parent.getByRole("dialog").getByRole("link", { name: "Night feed" }).click();
  await parent.getByLabel("Started").fill("22:00");
  await parent.getByLabel("Ended").fill("06:00");
  await parent.getByLabel("Pump rate, ml per hour").fill("30");
  await parent.getByLabel("How the night went").selectOption("Went well");
  await parent.getByRole("button", { name: "Save" }).click();

  await expect(parent).toHaveURL(/\/diary/);
  await expect(parent.getByText("240 ml · 10:00 PM to 6:00 AM · 30 ml/hr · Went well")).toBeVisible();
  await expect(parent.getByRole("link", { name: /^Night feed: 240 ml/ })).toBeVisible();
  await parent.screenshot({ path: `${shots}/8-diary.png`, fullPage: true });
});

test("a nurse's note shows on Home, with things to keep an eye on in a soft box", async ({ browser }) => {
  const nurse = await signIn(browser, "nurse@example.com");
  await nurse.getByRole("button", { name: "Add a moment" }).click();
  await nurse.getByRole("dialog").getByRole("link", { name: "Nurse text" }).click();
  await nurse.getByRole("button", { name: "Type it in myself" }).click();
  await nurse.getByLabel("Nurse name").fill("Nurse Pat");
  await nurse.getByLabel("Ate and drank, total").fill("24");
  await nurse.getByLabel("Keep an eye on").fill("A little congested after naps");
  await nurse.getByRole("button", { name: "Save" }).click();

  const parent = await signIn(browser, "parent@example.com");
  await expect(parent.getByRole("heading", { name: "From Josiah’s nurse" })).toBeVisible();
  await expect(parent.getByText("Nurse Pat checked in")).toBeVisible();
  await expect(parent.getByText("A little congested after naps")).toBeVisible();
  await parent.screenshot({ path: `${shots}/9-nurse-card.png`, fullPage: true });
});
