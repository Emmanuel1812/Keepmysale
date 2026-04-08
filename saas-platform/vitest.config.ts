import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    env: loadEnv("test", process.cwd(), ""),
  },
});
