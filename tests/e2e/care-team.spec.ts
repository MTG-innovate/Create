import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { shots, signIn } from "./helpers";

// Step 5: Josiah's helpers, practice at home, medicines, settings and photo.

test("helpers, a daily practice item and a medicine; grandma sees who did today's practice", async ({ browser }) => {
  const parent = await signIn(browser, "parent@example.com");
  await parent.getByRole("link", { name: "Care Circle", exact: true }).click();
  await expect(parent.getByRole("heading", { name: "Josiah’s helpers" })).toBeVisible();

  await parent.getByRole("link", { name: "+ Helper" }).click();
  await parent.getByLabel("Name *").fill("Dr. Example");
  await parent.getByLabel("Role").fill("Pediatrician");
  await parent.getByLabel("Phone").fill("404-555-0100");
  await parent.getByRole("button", { name: "Save" }).click();
  await expect(parent.getByRole("link", { name: "404-555-0100" })).toBeVisible();
  await expect(parent.getByRole("button", { name: "Copy 404-555-0100" })).toBeVisible();

  await parent.getByRole("link", { name: "+ Add", exact: true }).click();
  await parent.getByLabel("What to practice *").fill("Tummy time, 5 minutes");
  await parent.getByLabel("Who asked for it").fill("Physical therapy");
  await parent.getByLabel("How often").selectOption("Every day");
  await parent.getByRole("button", { name: "Save" }).click();

  await parent.getByRole("link", { name: "+ Medicine" }).click();
  await parent.getByLabel("Medicine *").fill("Iron drops");
  await parent.getByLabel("Dose").fill("0.5 ml");
  await parent.getByRole("button", { name: "Save" }).click();
  await expect(parent.getByRole("link", { name: /Iron drops/ })).toBeVisible();
  await expect(parent.getByRole("link", { name: "Children’s Healthcare of Atlanta guidance" })).toBeVisible();
  await parent.screenshot({ path: `${shots}/12-helpers.png`, fullPage: true });

  // Daily practice becomes a checklist on Home.
  const grandma = await signIn(browser, "grandma@example.com");
  await expect(grandma.getByRole("heading", { name: "Practice together today" })).toBeVisible();
  await parent.getByRole("link", { name: "Home", exact: true }).click();
  await parent.getByRole("checkbox", { name: /Tummy time, 5 minutes/ }).check();
  await expect(parent.getByText("done by you")).toBeVisible();
  await expect(grandma.getByText("done by Josiah's parent")).toBeVisible({ timeout: 10_000 });
  await expect(grandma.getByText("1 of 1")).toBeVisible();
});

test("a helper who can only see medicines cannot change them", async ({ browser }) => {
  const nurse = await signIn(browser, "nurse@example.com");
  await nurse.getByRole("link", { name: "Care Circle", exact: true }).click();
  await expect(nurse.getByRole("heading", { name: "Medicines" })).toBeVisible();
  await expect(nurse.getByRole("link", { name: "+ Medicine" })).toHaveCount(0);
  await expect(nurse.getByRole("link", { name: "+ Helper" })).toHaveCount(0);
});

test("settings: gentle words, Josiah's photo, and downloading everything", async ({ browser }) => {
  const parent = await signIn(browser, "parent@example.com");
  const scripture = /Psalm|Zechariah|Isaiah|Lamentations|Peter|Philippians/;
  await expect(parent.getByRole("figure").filter({ hasText: scripture })).toBeVisible();

  await parent.goto(parent.url() + "/settings");
  await parent.getByLabel("Daily encouragement").selectOption("gentle");
  await parent.getByRole("button", { name: "Save" }).nth(1).click();
  await expect(parent.getByText("Saved")).toBeVisible();

  // A tiny invented image stands in for a photo.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC",
    "base64",
  );
  await parent.getByLabel("Choose a photo of Josiah").setInputFiles({ name: "josiah.png", mimeType: "image/png", buffer: png });
  await expect(parent.getByText("Photo added")).toBeVisible();
  await expect(parent.getByRole("img", { name: "Josiah's photo" })).toBeVisible();

  const [download] = await Promise.all([parent.waitForEvent("download"), parent.getByRole("link", { name: "Download everything" }).click()]);
  const data = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(data.family.name).toBe("Josiah's Care Circle");
  expect(data.team_contacts.map((t: { name: string }) => t.name)).toContain("Dr. Example");
  expect(data.children[0].photo_path).toMatch(/\.jpg$/);

  await parent.getByRole("link", { name: "Home", exact: true }).click();
  await expect(parent.getByRole("img", { name: "Josiah's photo" })).toBeVisible();
  await expect(parent.getByRole("figure").filter({ hasText: scripture })).toHaveCount(0);
  await parent.screenshot({ path: `${shots}/13-home-photo.png`, fullPage: true });
});

test("an owner can add a brother or sister and permanently delete that child's data", async ({ browser }) => {
  const parent = await signIn(browser, "parent@example.com");
  await parent.goto(parent.url() + "/settings");
  await parent.getByText("Add a brother or sister").click();
  await parent.locator("#new-name").fill("Test Sibling");
  await parent.getByRole("button", { name: "Add", exact: true }).click();
  await expect(parent.getByRole("heading", { name: "Test Sibling", level: 1 })).toBeVisible();

  await parent.goto(parent.url() + "/settings");
  await parent.getByText("Delete Test Sibling’s data permanently").click();
  await parent.getByLabel("Type Test Sibling’s name to confirm").fill("Test Sibling");
  await parent.getByRole("button", { name: "Delete Test Sibling's data" }).click();
  await parent.getByRole("button", { name: "Tap again to delete forever" }).click();
  await expect(parent.getByText("That child’s data has been permanently deleted.")).toBeVisible();
  await expect(parent.getByRole("heading", { name: "Test Sibling" })).toHaveCount(0);
  await expect(parent.getByRole("heading", { name: "Josiah", exact: true })).toBeVisible();
});
