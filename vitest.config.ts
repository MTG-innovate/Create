import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    projects: [
      { extends: true, test: { name: "unit", include: ["src/**/*.test.ts"] } },
      {
        extends: true,
        // Needs a database: see scripts/test-db-local.sh, or `supabase start`.
        test: { name: "db", include: ["tests/db/**/*.test.ts"], fileParallelism: false, testTimeout: 20000 },
      },
    ],
  },
});
