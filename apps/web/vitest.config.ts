import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Web unit tests. Pure helpers run in node (no DOM); component-render tests
// would add jsdom later. The React plugin handles the JSX transform (the
// Next tsconfig sets jsx:preserve, which bare esbuild can't run).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts"],
    },
  },
});
