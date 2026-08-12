// https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// A handful of dependencies (@supabase/supabase-js, @tanstack/react-query)
// ship a package.json "exports" map that Metro fails to resolve correctly
// on Windows ("however this file does not exist" even though it does).
// Disabling package-exports resolution falls back to "main"/"module", which
// works fine for these packages.
config.resolver.unstable_enablePackageExports = false;

// .tools/ holds a portable Node.js runtime (~100MB, ~2500 files) used only to
// work around a Metro-on-Windows crash on this machine's system Node (see
// CLAUDE.md). It has nothing to do with the app's module graph, but Metro's
// file-map crawler still walks it on every cold start and watches it for
// changes — on Windows (no Watchman, JS-based crawler) that's a measurable
// chunk of startup time for zero benefit. Block it like Expo already blocks
// android/ios build output above.
config.resolver.blockList = [...config.resolver.blockList, /\.tools[\\/].*/];

module.exports = config;
