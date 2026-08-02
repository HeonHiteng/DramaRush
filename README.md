# DramaRush

A vertical short-drama streaming app, inspired by the general product experience of platforms like
TopReels — original branding, original mock content, real backend.

> **This is a client-review build, not a production release.** Authentication, content, favourites,
> unlocks, wallet, and subscription state are all real and backed by Supabase. Payments are the one
> thing still simulated — see [Known Limitations](#known-limitations).

The brand name **DramaRush** is a placeholder. It lives in one place — [`src/config/brand.ts`](src/config/brand.ts)
— so it can be swapped after client review without touching any screen code.

## What this demonstrates

- Visual design system (dark, cinematic, coral + gold accents)
- Navigation and screen transitions (Expo Router, stack + tabs)
- Content discovery (Home rails, Discover filters, Search) backed by a real Postgres database
- Vertical, swipeable episode playback (expo-video)
- Locked-episode monetization flows (coins, rewarded ads, membership) with real, persisted entitlements
- Real accounts (email/password, anonymous guest, Google/Apple OAuth once configured)
- The end-to-end customer journey, from onboarding to sign-in to watching to paying

## Technology stack

- Expo (SDK 57) + Expo Router (file-based navigation)
- TypeScript, `strict` mode
- [Supabase](https://supabase.com) (Postgres + Auth + Row Level Security) — schema lives in the
  separate [DramaRush-Backend](../DramaRush-Backend) repo
- `@tanstack/react-query` for data fetching/caching against Supabase
- React Native Reanimated + React Native Gesture Handler
- Zustand for client-side state (a write-through cache in front of Supabase; device-local settings
  stay in AsyncStorage)
- React Hook Form + Zod for the sign-in/sign-up form
- `expo-video` for playback
- `expo-linear-gradient`, `@expo/vector-icons`

## Project structure

```
app/                      Expo Router routes (screens)
  onboarding/  auth/  (tabs)/  series/  player/  wallet/  subscription/  settings/
src/
  components/ui/          Generic reusable components (buttons, sheets, badges, ...)
  components/media/       Content-specific components (posters, rails, video controls)
  features/player/        Player-only pieces (locked-episode overlay, rewarded ad, episode list sheet)
  lib/                    Supabase client, React Query client
  services/               React Query hooks over Supabase (series/episodes)
  data/                   Static config only now: coin packages, subscription plans, genre list
  store/                  Zustand stores (user, wallet, subscription, library, search, settings)
  theme/                  Design tokens (color, type, spacing, radius, shadow, motion)
  types/                  Shared TypeScript types
  config/                 Brand config
  hooks/  utils/
```

## Setup

Requires **Node.js ≥ 20.19.4** (or 22.13+). Expo SDK 57 / React Native 0.86 will not start on
older Node 20.x builds — Metro's bundler crashes on missing `util.styleText`. Check your version
with `node --version` before installing, and upgrade first if needed (nvm, or the official installer).

### 1. Backend

This app needs a Supabase project to run against. Follow the **[DramaRush-Backend](../DramaRush-Backend)**
repo's README once (create a free Supabase project, push the schema, enable anonymous sign-in) —
it takes about five minutes and only needs to be done once.

### 2. App

```bash
npm install
cp .env.example .env
```

Fill in `.env` with your Supabase project's **Project URL** and **anon/public key**
(Settings → API in the Supabase dashboard). The app will throw a clear startup error if these are
missing.

## Running the app

```bash
# Web (fastest way to preview — opens in your default browser)
npx expo start --web

# iOS simulator (macOS + Xcode required)
npx expo start --ios

# Android emulator (Android Studio + an AVD required)
npx expo start --android

# Expo Go (scan the QR code from `npx expo start` with the Expo Go app)
npx expo start
```

On wide desktop browsers, the app renders inside a centered, phone-sized frame rather than
stretching full-width — this is intentional (see `src/components/ui/WebFrame.tsx`) and only
applies on web at viewport widths ≥ 640px.

## Demo walkthrough

A reliable path to show a client everything in ~5 minutes:

1. **Splash → Onboarding** — three slides, Skip/Next, swipeable.
2. **Sign in** — Continue as Guest (a real anonymous Supabase account), or Sign Up with
   name/email/password (real account, no email confirmation required in dev). Google/Apple need
   one-time provider setup in Supabase first — see the backend repo's README.
3. **Home** — hero carousel, Continue Watching (empty on first run), Trending/New/Recommended/Free/
   Completed rails, genre rails, membership banner, all fetched from the database. Pull to refresh;
   note the loading skeleton on first paint.
4. **Discover** — genre chips, free/premium + ongoing/completed + language filters, sort control.
5. **Search** — type a title, genre, or cast name; note the debounce, recent/trending searches (real
   accounts persist recent searches across sessions), and the empty-results state for a nonsense query.
6. **Open a series** (e.g. "Crimson Contract") — synopsis, cast, favourite/share, episode list with
   free/coin/ad-unlock/members badges.
7. **Play episode 1** (free) — tap to pause/resume, swipe up for the next episode, swipe down to go
   back, try the side-rail controls (favourite, share, subtitles, speed, volume), open the episode
   list from the top-right icon.
8. **Swipe or jump to a locked episode** — the paywall sheet appears automatically. Try:
   - **Watch Advertisement** on an ad-unlock episode — 5s simulated ad, close button appears only
     after the countdown, "Reward earned!", episode unlocks via the `redeem_ad_reward()` database function.
   - **Unlock for N coins** on a coin-locked episode — success animation, playback begins. Reopen
     the same episode later: it does **not** charge coins again (`unlock_episode_with_coins()` is
     atomic and idempotent at the database level, not just checked client-side).
   - A members-only episode routes straight to the **Membership** screen.
9. **Wallet** (via the header wallet icon or Profile) — buy a coin package, watch the confirm →
   processing → success flow, see the transaction land in history. The purchase trigger itself is
   still simulated (no payment processor), but the resulting balance and transaction are real rows.
10. **Subscription** — start a membership, see the coin bonus, renewal date, and Premium badge
    appear on Profile.
11. **Library** — Continue Watching, Favourites (remove one), Unlocked Series, Watch History
    (remove an entry).
12. **Sign out and back in** with the same account — favourites, unlocks, progress, coins, and
    membership are all still there, because they live in Supabase, not on the device.
13. **Profile → Demo Controls** (see below) → **Reset Prototype**, with confirmation — verify it
    signs the account out and drops you back at Onboarding with a clean slate.

## Demo Controls

Profile → scroll to the blue **Demo Controls** panel (only rendered when `__DEV__` is true, i.e.
never in a production build). It exists to make live demos repeatable without manual setup:

- `+500 Coins` / `Remove All Coins`
- `Activate Membership` / `Cancel Membership`
- `Lock All Premium` / `Unlock All Episodes`
- `Clear Viewing History`
- `Reset Entire Prototype` (same confirmation flow as Profile's own Reset Prototype)

A small **PROTOTYPE** badge also appears next to the Profile header in dev builds.

## Content

The catalog — 8 original fictional series (none of the titles, characters, or artwork are copied
from any real product), a mix of Romance, Suspense, Revenge, Comedy, Fantasy, Youth, Mystery, and
Workplace genres, each with 6–8 episodes — lives in the `series`/`episodes` tables in Supabase (see
the backend repo). Episode access is deliberately mixed per series: free, coin-locked (with a
price), subscriber-only, and rewarded-ad-unlock.

Posters/banners are **gradient placeholders** (no external images), generated from per-series color
pairs stored on each series row — this keeps the app free of any image licensing questions.

Episode video is a small rotating pool of publicly hosted, openly-licensed reference clips: Google's
official ExoPlayer/Media3 test-media bucket, the long-standing W3Schools HTML5 video tutorial clip
(Big Buck Bunny, a Blender Foundation CC-BY film), and a Mozilla-hosted CC0 clip used in MDN's own
`<video>` documentation. They're landscape source clips rendered inside the portrait 9:16 player —
in production these would be replaced by real vertically-shot drama footage on a CDN.

## Known limitations

- **Payments** — coin purchases and membership activation are still simulated at the trigger level:
  tapping "Confirm purchase" writes directly to the database without a real charge. No Stripe,
  RevenueCat, or App Store/Play Store IAP integration yet.
- **Google/Apple sign-in** — fully wired to Supabase's OAuth flow, but inert until you configure the
  providers (one-time dashboard setup — see the backend repo's README). Apple also needs native
  `expo-apple-authentication` before an App Store submission that also offers other social logins.
- **Advertisements** — the rewarded ad is a labeled placeholder screen with a countdown, not a real
  ad SDK.
- **Backend content management** — series/episodes are edited via direct SQL for now, no admin/CMS UI.
- **Analytics** — no event tracking of any kind.
- **Push notifications** — the notification toggle in Settings has no delivery mechanism behind it.
- **Secure video delivery** — video is streamed from public reference URLs with no DRM, signed URLs,
  or CDN.
- **Device-local settings** (notification toggle, playback quality, subtitles-by-default, language,
  onboarding-seen flag) intentionally stay in AsyncStorage, not synced to the backend.

Everything else — accounts, content, favourites, unlocks, watch history, progress, coin balance and
transactions, and subscription status — is real, persisted in Postgres, and syncs across sign-ins.

## Testing

```bash
npm test
```

Focused Jest tests cover: search filtering, coin deduction, duplicate-unlock prevention, insufficient-
coin handling, favourite toggling, viewing-progress persistence (including the ~90% "watched"
threshold), subscription entitlement, and full prototype reset behavior. Store-layer tests run
against an in-memory mock of the Supabase client (`src/testUtils/supabaseMock.ts`) that mirrors the
real `unlock_episode_with_coins()`/`redeem_ad_reward()` database functions, so they stay fast and
offline. See `src/__tests__/`.

```bash
npm run lint        # ESLint (eslint-config-expo)
npm run typecheck    # tsc --noEmit, strict mode
```

## Suggested production roadmap

1. Integrate a real payment provider (App Store/Play Store IAP for coins and subscriptions, with
   server-side receipt validation) and a real rewarded-ad SDK.
2. Finish Google/Apple sign-in provider setup and add native Sign In with Apple for iOS.
3. Move video to a real CDN with adaptive bitrate streaming and DRM/signed URLs; add original,
   vertically-shot content.
4. Add analytics (funnel tracking through onboarding → paywall → purchase) and push notifications.
5. Add an admin/CMS portal for managing series, episodes, pricing, and promotions (currently direct SQL).
6. Replace gradient poster/banner placeholders with real artwork and an image CDN.
7. Sync device-local settings (notifications, playback, language) to the backend if cross-device
   consistency matters for those.
8. Expand automated test coverage to integration/E2E (Detox or Maestro) against a real Supabase test
   project, alongside the existing unit tests, and add CI.
