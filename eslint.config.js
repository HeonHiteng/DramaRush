// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // These React Compiler-oriented rules flag the documented mutation-based
    // APIs of react-native-reanimated (`sharedValue.value = ...`) and
    // expo-video (`player.currentTime = ...`), plus ordinary effect-driven
    // setState (e.g. resetting local UI state when a prop changes). This
    // project doesn't opt into the React Compiler, so both are disabled.
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // Tests use `jest.mock('@/lib/supabase', () => require(...))` above the
    // ES imports — the standard pattern for module-level Jest mocks — which
    // trips these two otherwise-useful style rules.
    files: ["src/__tests__/**/*.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "import/first": "off",
    },
  },
]);
