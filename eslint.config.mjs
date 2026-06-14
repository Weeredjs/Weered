import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/node_modules/**", "**/.next/**", "**/dist/**", "**/build/**",
      "**/.gradle/**", "**/*.config.*", "apps/desktop/src-tauri/**",
      "_diagnostics/**", "_snapshots/**", "**/*.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-empty": "off",
      "no-control-regex": "off",
      "prefer-const": "warn",
    },
  },
];
