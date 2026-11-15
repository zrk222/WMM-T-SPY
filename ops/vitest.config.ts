import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    hookTimeout: 180_000,
    testTimeout: 40_000,
    include: ["tests/**/*.test.ts"],
    env: {
      MONGODB_DB: "cloudops_test",
      JWT_SECRET: "test-secret-test-secret",
      BASE_URL: "http://127.0.0.1:3100",
      RATE_LIMIT_MULTIPLIER: "40",
    },
  },
});
