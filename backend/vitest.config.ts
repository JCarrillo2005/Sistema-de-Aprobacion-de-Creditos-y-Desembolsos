import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "vitest/config";

// Carga TEST_DATABASE_URL (y demás variables) desde backend/.env si existe.
if (existsSync(".env")) {
  loadEnvFile(".env");
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
    restoreMocks: true,
    env: {
      NODE_ENV: "test",
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgres://credit:credit@localhost:5432/credit_test",
      JWT_SECRET: "test-secret",
    },
  },
});
