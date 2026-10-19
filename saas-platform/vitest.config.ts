import { configDefaults, defineConfig } from "vitest/config";
import { loadEnv } from "vite";

// These files talk to the REAL Supabase project (.env.test points at the live one) and create/delete rows
// there. A plain `vitest run` must never do that by accident, so they only run when asked:
//   KMS_LIVE_TESTS=1 npx vitest run
const LIVE_DATABASE_TESTS = [
  "src/tests/e2e-pipeline.test.ts",
  "src/tests/refund-service.test.ts",
  "src/tests/shopify-webhook.test.ts",
];

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    env: loadEnv("test", process.cwd(), ""),
    exclude: process.env.KMS_LIVE_TESTS ? configDefaults.exclude : [...configDefaults.exclude, ...LIVE_DATABASE_TESTS],
  },
});
