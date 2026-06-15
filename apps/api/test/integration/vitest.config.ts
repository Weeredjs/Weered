import { defineConfig } from "vitest/config";

// Integration tests hit a real Postgres (the weered_test DB) through the real
// route modules via Fastify .inject(). Run serially in a single fork so test
// files can't race each other on the shared test database.
export default defineConfig({
  test: {
    include: ["test/integration/**/*.test.ts"],
    globalSetup: ["test/integration/setup.ts"],
    fileParallelism: false, // serialize files — they share the weered_test DB
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
