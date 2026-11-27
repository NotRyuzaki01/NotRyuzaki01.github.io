import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["assets/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["eslint.config.js", "scripts/**/*.mjs", "tests/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
];
