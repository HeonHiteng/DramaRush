# Keybox app — project context for Claude

Read this first in any new session before touching code.

## What this is

**Keybox**, a vertical short-drama streaming app (Expo SDK 57, expo-router, React Native + web).
"DramaRush" was a placeholder name; the folder and the GitHub repos `HeonHiteng/DramaRush` (this app)
and `HeonHiteng/DramaRush-Backend` keep it. We own both repos now. **Rule: the UI/UX must not
change** — only data, playback and security logic, and bug fixes.

- Backend: `../DramaRush-Backend` (Supabase project `keybox`, ref `ogqagauogrzezfmveewk`, plus
  Cloudflare Stream). Its `CLAUDE.md`, `README.md` and `docs/frontend-api.md` describe every RPC and
  Edge Function the app calls.
- Content team uploads through the backend's standalone admin console (`../DramaRush-Backend/admin`),
  not through this app (the in-app `/admin` screens still work for single episodes).

## How the app talks to the backend

- `src/lib/supabase.ts` — the client. `supabaseConfigError` is checked in `app/_layout.tsx` (a
  module-level throw can't be caught by an error boundary).
- Coins, unlocks, memberships, daily mission and resets are **server-side RPCs**
  (`unlock_episode_with_coins`, `redeem_ad_reward`, `simulate_purchase`, `simulate_subscribe`,
  `cancel_subscription`, `reset_my_data`, …). Clients can only read those tables. Payments are
  simulated until RevenueCat.
- Playback: `src/services/playback.ts` calls the `playback-token` Edge Function **only for the episode
  on screen** (no preloading — Stream bills delivered minutes). It returns a 15-minute signed HLS URL
  and the viewer's watermark code. `PlayerPage.tsx` re-fetches on expiry/error and resumes; a
  `not_entitled` answer opens the paywall. `WatermarkOverlay` shows the code.
- Anti-capture: `src/hooks/usePlaybackProtection.ts` (expo-screen-capture while the player is open;
  `.web.ts` is a no-op). Verified on Android via Expo Go (screenshots refused, recordings black).
- Web HLS: `src/features/player/hlsBridge.web.ts` attaches hls.js when the browser has no native HLS;
  `?hlsjs` forces it.
- `src/services/content.ts` selects explicit episode columns (never `video_uri`, which is being
  retired) and only `published` episodes.
- Zustand stores are a write-through cache in front of Supabase; `AuthListener.tsx` hydrates/resets
  them on session change. Local keys are `keybox/*` (`src/store/storage.ts` migrates old
  `dramarush/*` keys on first read).
- Tests: `src/testUtils/supabaseMock.ts` re-implements the RPC rules in JS — keep it in step with the
  SQL in the backend repo.

## Running it

- Install deps with `npm ci --workspaces=false` (the `D:\aiseahub` root is an npm workspace; a plain
  install hoists into the root and breaks the app).
- Web preview: root `D:\aiseahub\.claude\launch.json` config `keybox-web` (port 8081).
- Phone: `npx expo start --lan --port 8081`, scan with Expo Go (same Wi-Fi; allow Node through the
  Windows firewall). The same server also serves the web build.
- If the browser pane is hidden, rAF/onLayout don't fire and pages look blank — not an app bug.
- `metro.config.js` disables `unstable_enablePackageExports` (Metro on Windows can't resolve
  supabase-js / react-query exports otherwise). Don't remove it without re-testing.
- Checks: `npx tsc --noEmit`, `npx eslint .`, `npx jest`.

## Still open

Placeholders: bundle id `com.dramarush.prototype`, `supportEmail`/`websiteUrl` in
`src/config/brand.ts` (waiting for real values). Turnstile captcha on guest sign-in, RevenueCat,
AdMob server-side verification, Apple/Google sign-in on the new project.
