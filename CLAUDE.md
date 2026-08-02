# DramaRush — project context for Claude

Read this first in any new session before touching code. It's the fast path to full context
without re-reading the whole history.

## What this is

A vertical short-drama streaming app (original brand, inspired by the TopReels product category —
no TopReels branding/assets anywhere). Started as a fully client-side prototype, then migrated to a
**real Supabase backend**. Two sibling repos:

- **This repo** (`Login Testing` — yes, that's really the folder name, harmless) — the Expo app.
- **`../DramaRush-Backend`** — Supabase SQL migrations (schema, RLS, functions, seed data). Not a
  server you run; it's SQL that configures a Supabase project.

Both are local git repos. This app repo is also pushed to `https://github.com/HeonHiteng/DramaRush`.
The backend repo has not been pushed anywhere yet (still local-only).

## Current state (as of last session)

- **Backend is live.** The user created a Supabase project, ran all 5 migrations via the SQL
  Editor, and enabled Anonymous Sign-Ins. `.env` in this repo has real `EXPO_PUBLIC_SUPABASE_URL`
  and `EXPO_PUBLIC_SUPABASE_ANON_KEY` values (gitignored, not in the repo).
- Everything except payments is real: auth (guest/email; Google/Apple wired but not
  provider-configured yet), content (series/episodes from Postgres), favourites, unlocks, watch
  history, progress, coin wallet/transactions, subscription status.
- **Not yet done in this session**: hadn't actually smoke-tested the app against the live backend
  yet (sign up, browse, unlock an episode) — that's the natural next step if resuming.
- `typecheck`, `lint`, and all 22 Jest tests pass as of the last commit (`ab66006`). `expo export
  --platform web` bundles clean.

## Environment quirks (don't rediscover these)

- **Node version**: this machine's system Node is 20.10.0, which crashes Metro on Expo SDK 57 /
  RN 0.86 (`util.styleText` missing). A portable Node 22.14.0 lives at `.tools/node-v22.14.0-win-x64/`
  (gitignored) specifically to work around this. `.claude/launch.json`'s `dramarush-web` config
  already points at a wrapper script (`.tools/start-web.cmd`) that prepends it to PATH — use
  `preview_start` with that config name, don't invoke `expo start` directly without it.
- **metro.config.js** disables `unstable_enablePackageExports` — without this, Metro fails to
  resolve `@supabase/supabase-js` and `@tanstack/react-query` on Windows with a "however this file
  does not exist" error, even though the files exist. Don't remove this without confirming that bug
  is actually fixed upstream.
- Running `npx tsc`, `npx eslint`, `npx jest` etc. via plain Bash works fine on system Node — it's
  only the Metro dev server / `expo export` that need the portable Node 22.

## Architecture (so you don't relearn it by reading every file)

- `src/lib/supabase.ts` — the Supabase client. Exports `supabaseConfigError: string | null` — checked
  explicitly in `app/_layout.tsx` (NOT via a thrown error / error boundary — a module-level throw
  happens before React renders anything and isn't catchable by an error boundary; learned this the
  hard way).
- `src/services/content.ts` — React Query hooks (`useSeries`, `useEpisodes`, `useSeriesById`,
  `useEpisodesForSeries`, `useEpisodeById`) wrapping `supabase.from('series'|'episodes')`. Content
  is small (8 series, 54 episodes) so it's fetched in full and filtered client-side rather than
  querying per-screen.
- `src/store/*.ts` — Zustand stores are a **write-through cache** in front of Supabase, not a
  source of truth themselves anymore (except `settingsStore`, which stays device-local/AsyncStorage
  on purpose — see README "Known limitations"). Each data store (`libraryStore`, `walletStore`,
  `subscriptionStore`, `searchStore`) has `hydrateFromServer()` and `resetLocal()`, called by...
- `src/store/AuthListener.tsx` — mounted once in `app/_layout.tsx`. Listens to
  `supabase.auth.onAuthStateChange`, keeps `userStore.user` in sync, and calls
  `hydrateFromServer()`/`resetLocal()` on the other stores when the session changes. This is the
  one place that coordinates all the stores together.
- **Unlock flows are atomic in the database**, not just checked client-side:
  `unlock_episode_with_coins(episode_id)` and `redeem_ad_reward(episode_id)` are Postgres RPCs
  (`DramaRush-Backend/supabase/migrations/20260802000004_functions.sql`) called via
  `supabase.rpc(...)` from `libraryStore.ts`. They're idempotent — calling twice for an
  already-unlocked episode returns `true` without a second charge.
- `src/testUtils/supabaseMock.ts` — an in-memory fake of the Supabase client used by the Jest
  suites (`jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'))` at the top of
  each test file). It re-implements the two RPC functions' logic in JS to keep unit tests fast and
  offline. If you change the real SQL functions, update this mock to match.

## Explicit non-goals (don't build these unless asked)

Real payments (Stripe/RevenueCat/App Store IAP), native Apple Sign In, an admin/CMS for content,
analytics, push notifications, syncing device-local settings to the backend. All listed with
rationale in this repo's `README.md` under "Known limitations" / "Suggested production roadmap".

## Where to look for more detail

- `README.md` (this repo) — full setup, demo walkthrough, known limitations, roadmap.
- `../DramaRush-Backend/README.md` — Supabase setup steps, OAuth provider setup, content-editing
  notes.
- `src/config/brand.ts` — the brand name "DramaRush" is a placeholder, change it here only.
