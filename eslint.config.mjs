import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/.gradle/**",
      "**/*.config.*",
      "apps/desktop/src-tauri/**",
      "_diagnostics/**",
      "_snapshots/**",
      "**/*.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // TypeScript itself resolves undefined identifiers and globals; no-undef is
      // redundant here and produces false positives on Node/browser globals.
      // (This is the typescript-eslint project's own recommendation.)
      "no-undef": "off",
      // Warn (non-blocking in CI) on `any` to cap growth of the ~3,300 existing
      // casts without a big-bang burn-down.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "no-empty": "off",
      "no-control-regex": "off",
      "no-useless-escape": "warn",
      "no-extra-boolean-cast": "warn",
      "no-irregular-whitespace": "warn",
      "no-constant-condition": ["warn", { checkLoops: false }],
      "prefer-const": "warn",
    },
  },
  // Web app: register the React-hooks + Next plugins so the inline
  // eslint-disable directives in the Next code resolve, and surface their
  // findings as warnings (advisory, not gating).
  {
    files: ["apps/web/**/*.{ts,tsx,js,jsx}"],
    plugins: { "react-hooks": reactHooks, "@next/next": nextPlugin },
    rules: {
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",
      ...nextPlugin.configs.recommended.rules,
      "@next/next/no-img-element": "warn",
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];
