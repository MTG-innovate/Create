import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against `supabase start` and a production build of the
// app (see .github/workflows/ci.yml). They use the demo family from
// supabase/seed.sql and read sign-in emails from the local mail viewer.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: "http://127.0.0.1:3000",
    ...devices["iPhone 13"],
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
