import { defineConfig } from "vitest/config";

// Base config for the API unit suite + coverage. Integration tests keep their
// own config (test/integration/vitest.config.ts) since they serialize on the
// shared weered_test DB. Coverage is emitted as lcov for SonarCloud.
export default defineConfig({
  test: {
    include: ["test/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      reportsDirectory: "./coverage/unit",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/types/**"],
    },
  },
});
