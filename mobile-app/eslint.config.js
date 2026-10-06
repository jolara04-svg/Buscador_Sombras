// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    files: ["src/components/solar-scene-content.tsx"],
    rules: {
      "react/no-unknown-property": "off",
    },
  },
  {
    files: ["src/hooks/use-color-scheme.web.ts"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);
