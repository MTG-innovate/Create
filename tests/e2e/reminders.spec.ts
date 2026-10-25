import { expect, test } from "@playwright/test";
import { shots, signIn } from "./helpers";

// Step 8: reminders. A test browser has no push service, so these check what
// can be checked without one: the settings people see, the app being
// installable, and the reminder sender refusing anyone without the secret.

test("Settings offers reminders on this phone", async ({ browser }) => {
  const parent = await signIn(browser, "parent@example.com");
  // As if the parent had already allowed notifications for JOSIA Care.
  await parent.context().grantPermissions(["notifications"]);
  await parent.goto(parent.url() + "/settings");
  const section = parent.locator("section", { has: parent.getByRole("heading", { name: "Reminders on this phone" }) });
  await expect(section).toBeVisible();
  // What it says depends on the phone: the test browser looks like an iPhone,
  // may have no push service and may block notifications, so any of these is right.
  await expect(section).toContainText(
    /Turn on reminders|add JOSIA Care to your Home Screen first|This browser cannot show reminders|Notifications are turned off/,
  );
  console.log(`Reminders section: ${await section.innerText()}`);
  await section.screenshot({ path: `${shots}/17-reminders.png` });
});

test("JOSIA Care can be added to a phone's home screen", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "JOSIA Care", display: "standalone", start_url: "/" });
  expect((await request.get("/sw.js")).ok()).toBe(true);
  expect((await request.get("/icon-512.png")).ok()).toBe(true);
});

test("the reminder sender needs the secret", async ({ request }) => {
  expect((await request.get("/api/reminders")).status()).toBe(401);
  expect((await request.get("/api/reminders", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
  const ok = await request.get("/api/reminders", { headers: { authorization: "Bearer local-reminder-secret" } });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toMatchObject({ sent: 0 });
});
