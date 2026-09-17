import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import prettierConfig from "eslint-config-prettier";

export default defineConfig([
  { ignores: ["generated/**", "node_modules/**"] },
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // Intentionally-unused args/vars are marked with a leading underscore,
      // e.g. the `_next` Express requires in 4-arg error handlers, or rest-omit
      // destructuring used to strip internal fields before responding.
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
  { files: ["**/*.test.js"], languageOptions: { sourceType: "module" } },
  prettierConfig,
]);