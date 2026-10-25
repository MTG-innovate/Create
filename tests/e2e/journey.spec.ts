import { expect, test } from "@playwright/test";
import { shots, signIn } from "./helpers";

// Step 4: Josiah's journey, compared only to Josiah. The demo seed has an
// invented birth weight of 4 lb 2 oz.

test("a weigh in grows the chart and shows the gain since birth", async ({ browser }) => {
  const parent = await signIn(browser, "parent@example.com");
  await parent.getByRole("link", { name: "Journey", exact: true }).click();
  await expect(parent.getByText("This page only compares Josiah to Josiah. No percentiles, no other babies.")).toBeVisible();

  await parent.getByRole("link", { name: "Log a weigh in", exact: true }).click();
  await parent.getByLabel("Pounds").fill("9");
  await parent.getByLabel("Ounces").fill("4");
  await parent.getByRole("button", { name: "Save" }).click();

  await expect(parent.getByRole("heading", { name: "Up 5 lb 2 oz" })).toBeVisible();
  await expect(parent.getByText("+5 lb 2 oz")).toBeVisible();
  await expect(parent.getByRole("img", { name: /Weight over time, from 4 lb 2 oz to 9 lb 4 oz/ })).toBeVisible();
  await parent.screenshot({ path: `${shots}/10-journey.png`, fullPage: true });

  await parent.getByRole("link", { name: "Home", exact: true }).click();
  await expect(parent.getByRole("link", { name: /Up 5 lb 2 oz since birth/ })).toBeVisible();
});

test("a win joins the journey, and a bright spot from grandma reaches the parent's Home", async ({ browser }) => {
  const parent = await signIn(browser, "parent@example.com");
  await parent.getByRole("link", { name: "Journey", exact: true }).click();
  await parent.getByRole("link", { name: "Celebrate a win" }).click();
  await parent.getByLabel("What happened *").fill("First smile at Nurse Pat");
  await parent.getByLabel("Kind of win").selectOption("A first");
  await parent.getByRole("button", { name: "Save" }).click();
  await expect(parent).toHaveURL(/\/journey$/); // the celebration tidies the address afterwards
  await expect(parent.getByRole("link", { name: /First smile at Nurse Pat/ })).toBeVisible();

  await parent.getByRole("link", { name: "Home", exact: true }).click();
  const grandma = await signIn(browser, "grandma@example.com");
  await grandma.getByLabel("What was good today?").fill("Held the bottle with both hands");
  await grandma.getByRole("button", { name: "Save" }).last().click();
  await expect(grandma.getByText("Saved to the journey")).toBeVisible();
  await expect(grandma.getByLabel("What was good today?")).toHaveValue("");

  await expect(parent.getByRole("link", { name: /Held the bottle with both hands/ })).toBeVisible({ timeout: 10_000 });
  await parent.screenshot({ path: `${shots}/11-bright-spots.png`, fullPage: true });
});
