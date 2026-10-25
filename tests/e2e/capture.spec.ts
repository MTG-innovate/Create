import { expect, test } from "@playwright/test";
import { shots, signIn } from "./helpers";

// Step 7: a nurse text, a therapy handoff or a visit summary becomes a draft
// that a person checks and saves. Claude is played by tests/e2e/mock-claude.ts.

test("a nurse text pasted on a phone becomes a reviewed nurse note", async ({ browser }) => {
  const nurse = await signIn(browser, "nurse@example.com");
  await nurse.getByRole("button", { name: "Add a moment" }).click();
  await nurse.getByRole("dialog").getByRole("link", { name: "Nurse text" }).click();
  await expect(nurse.getByRole("heading", { name: "Nurse text" })).toBeVisible();
  await nurse.getByLabel("The nurse’s text").fill("Hi! Josiah had 4 bottles today, 21 oz total, 6 wet 2 dirty. Some spit up after noon. — Robin");
  await nurse.getByRole("button", { name: "Sort it for me" }).click();

  // The draft opens in the usual form. Nothing is saved yet.
  await expect(nurse.getByText("Nothing is saved until you tap Save")).toBeVisible();
  await expect(nurse.getByLabel("Nurse name")).toHaveValue("Nurse Robin");
  await expect(nurse.getByLabel("Ate and drank, total")).toHaveValue("21");
  await expect(nurse.getByLabel("Keep an eye on")).toHaveValue("A little spit up after the noon bottle");
  await expect(nurse.getByLabel("Full report")).toHaveValue(/21 oz total/);
  await nurse.screenshot({ path: `${shots}/15-nurse-draft.png`, fullPage: true });

  // The person changes what they want, then saves.
  await nurse.getByLabel("Keep an eye on").fill("A little spit up after the noon bottle. Watch the next one.");
  await nurse.getByRole("button", { name: "Save" }).click();

  const parent = await signIn(browser, "parent@example.com");
  await expect(parent.getByText("Nurse Robin checked in")).toBeVisible();
  await expect(parent.getByText("Watch the next one.")).toBeVisible();
});

test("a doctor visit summary fills in the visit, keeps medicine changes in the notes, and offers the next appointment", async ({ browser }) => {
  const parent = await signIn(browser, "parent@example.com");
  await parent.getByRole("button", { name: "Add a moment" }).click();
  await parent.getByRole("dialog").getByRole("link", { name: "Doctor visit" }).click();
  await parent.getByLabel("Which visit").selectOption("GI");
  await parent.getByLabel("Text copied from MyChart").fill("After Visit Summary. GI clinic. Reflux better. Stop famotidine after this week. Return in 3 months.");
  await parent.getByRole("button", { name: "Sort it for me" }).click();

  await expect(parent.getByText("Medicine changes are kept in the visit notes")).toBeVisible();
  await expect(parent.getByLabel("Type")).toHaveValue("GI");
  await expect(parent.getByLabel("What happened at the visit")).toHaveValue("Weight up nicely. Reflux is better.");
  await expect(parent.getByLabel("What we need to do at home")).toHaveValue(/Medicine changes: Famotidine stops after this week\./);
  await parent.screenshot({ path: `${shots}/16-visit-draft.png`, fullPage: true });
  await parent.getByRole("button", { name: "Save" }).click();

  // Then the next appointment it mentioned, ready to check and add.
  await expect(parent.getByRole("heading", { name: "The next appointment they mentioned" })).toBeVisible();
  await expect(parent.getByLabel("Date *")).toHaveValue("2099-01-15");
  await expect(parent.getByLabel("Time")).toHaveValue("09:30");
  await expect(parent.getByLabel("What is it")).toHaveValue("GI follow up");
  await parent.getByRole("button", { name: "Save" }).click();

  // The medicine list is untouched.
  await parent.getByRole("link", { name: "Care Circle", exact: true }).click();
  await expect(parent.getByText(/Famotidine/)).toHaveCount(0);
});

test("a therapy handoff can be typed in without Claude", async ({ browser }) => {
  const parent = await signIn(browser, "parent@example.com");
  await parent.getByRole("button", { name: "Add a moment" }).click();
  await parent.getByRole("dialog").getByRole("link", { name: "Therapy handoff" }).click();
  await parent.getByLabel("Which visit").selectOption("Speech therapy");
  await parent.getByLabel("What the therapist told you").fill("Lots of babbling today.");
  await parent.getByRole("button", { name: "Type it in myself" }).click();
  await expect(parent.getByText("Nothing is saved until you tap Save")).toHaveCount(0);
  await expect(parent.getByLabel("Type")).toHaveValue("Speech therapy");
  await expect(parent.getByLabel("What happened at the visit")).toHaveValue("Lots of babbling today.");
});
