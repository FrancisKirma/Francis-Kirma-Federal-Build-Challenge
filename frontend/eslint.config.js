import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage", "public"] },
  { files: ["**/*.{ts,tsx}"], extends: [js.configs.recommended] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // AGENTS.md: no `any` outside *.test.ts.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // Config files are not part of the app's TS project.
    files: ["*.config.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ["**/*.test.{ts,tsx}", "src/test-setup.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
);
