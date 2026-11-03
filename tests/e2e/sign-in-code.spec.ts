import { expect, test } from "@playwright/test";
import { signInCode } from "./helpers";

// From the Home Screen, an emailed link opens in the browser instead of the
// app, so the email also carries a code to type in the app itself.

test("the code from the sign-in email signs a person in without leaving the app", async ({ page }) => {
  const email = "nurse@example.com";
  for (let attempt = 1; ; attempt++) {
    await page.goto("/sign-in");
    await page.getByLabel("Your email").fill(email);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    const sent = page.getByRole("heading", { name: "Check your email" });
    const refused = page.getByRole("alert").filter({ hasText: /Too many tries|could not send/ });
    await expect(sent.or(refused)).toBeVisible();
    if (await sent.isVisible()) break;
    if (attempt === 6) throw new Error(await refused.innerText());
    await page.waitForTimeout(5000);
  }
  const since = Date.now() - 5000;

  await page.getByLabel("Code from the email").fill("000000");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("That code did not work. Check the newest email, or ask for a new one.")).toBeVisible();

  await page.getByLabel("Code from the email").fill(await signInCode(email, since));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/f\/[0-9a-f-]{36}$/);
});
