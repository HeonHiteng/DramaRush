// https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// A handful of dependencies (@supabase/supabase-js, @tanstack/react-query)
// ship a package.json "exports" map that Metro fails to resolve correctly
// on Windows ("however this file does not exist" even though it does).
// Disabling package-exports resolution falls back to "main"/"module", which
// works fine for these packages.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
