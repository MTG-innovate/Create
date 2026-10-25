import { expect, test } from "@playwright/test";
import { shots, signIn, todayInNewYork } from "./helpers";

// Step 6: questions to ask, and the visit sheet that gathers everything for a helper.

test("a question for cardiology shows on Home and on the cardiology visit sheet, ready to copy", async ({ browser }) => {
  const parent = await signIn(browser, "parent@example.com");
  await parent.context().grantPermissions(["clipboard-read", "clipboard-write"]);

  // A question, from the + menu.
  await parent.getByRole("button", { name: "Add a moment" }).click();
  await parent.getByRole("link", { name: "A question" }).click();
  await parent.getByLabel("Question *").fill("Is the murmur any quieter?");
  await parent.getByLabel("For").fill("Cardiology");
  await parent.getByRole("button", { name: "Save" }).click();
  await expect(parent.getByRole("heading", { name: "Questions to ask" })).toBeVisible();
  await expect(parent.getByText("For Cardiology")).toBeVisible();

  await parent.getByRole("link", { name: "+ Question" }).click();
  await parent.getByLabel("Question *").fill("When can Josiah start solids?");
  await parent.getByLabel("For").fill("Pediatrician");
  await parent.getByRole("button", { name: "Save" }).click();

  // A medicine, so the sheet has one to list.
  await parent.getByRole("link", { name: "Care Circle", exact: true }).click();
  await parent.getByRole("link", { name: "+ Medicine" }).click();
  await parent.getByLabel("Medicine *").fill("Furosemide");
  await parent.getByLabel("Dose").fill("1 ml");
  await parent.getByRole("button", { name: "Save" }).click();

  // A cardiology visit today, and its sheet.
  await parent.getByRole("link", { name: "Visits", exact: true }).click();
  await parent.getByRole("link", { name: "+ Visit" }).click();
  await parent.getByLabel("Type").selectOption("Cardiology");
  await parent.getByLabel("What is it").fill("Heart checkup");
  await parent.getByLabel("Date *").fill(todayInNewYork());
  await parent.getByLabel("Time").fill("23:45");
  await parent.getByRole("button", { name: "Save" }).click();
  await parent.getByRole("link", { name: /Heart checkup/ }).first().click();
  await parent.getByRole("link", { name: "Visit sheet" }).click();

  const sheet = parent.getByRole("article");
  await expect(sheet.getByRole("heading", { name: "Current medicines" })).toBeVisible();
  await expect(sheet.getByText(/Furosemide/)).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "Our questions" })).toBeVisible();
  await expect(sheet.getByText("Is the murmur any quieter?")).toBeVisible();
  await expect(sheet.getByText("When can Josiah start solids?")).toHaveCount(0);
  await parent.screenshot({ path: `${shots}/14-visit-sheet.png`, fullPage: true });

  await parent.getByRole("button", { name: "Copy sheet" }).click();
  await expect(parent.getByText("Copied")).toBeVisible();
  const text = await parent.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("CURRENT MEDICINES");
  expect(text).toContain("Is the murmur any quieter?");
});
