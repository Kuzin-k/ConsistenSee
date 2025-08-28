import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // You can add custom rules here
    }
  },
  {
    ignores: ["dist/", "node_modules/", "coverage/", "esbuild.config.js"]
  }
];
