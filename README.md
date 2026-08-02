# DramaRush (Prototype)

A polished, client-review prototype of a vertical short-drama streaming app, inspired by the general
product experience of platforms like TopReels — original branding, original mock content, no real
backend.

> **This is a design/UX prototype, not a production release.** See [Known Limitations](#known-limitations)
> for exactly what's simulated.

The brand name **DramaRush** is a placeholder. It lives in one place — [`src/config/brand.ts`](src/config/brand.ts)
— so it can be swapped after client review without touching any screen code.

## What this demonstrates

- Visual design system (dark, cinematic, coral + gold accents)
- Navigation and screen transitions (Expo Router, stack + tabs)
- Content discovery (Home rails, Discover filters, Search)
- Vertical, swipeable episode playback (expo-video)
- Locked-episode monetization flows (coins, rewarded ads, membership)
- Subscription and coin/wallet concepts
- The end-to-end customer journey, from onboarding to sign-in to watching to paying

## Technology stack

- Expo (SDK 57) + Expo Router (file-based navigation)
- TypeScript, `strict` mode
- React Native Reanimated + React Native Gesture Handler
- Zustand (+ AsyncStorage persistence) for state
- React Hook Form + Zod for the email sign-in form
- `expo-video` for playback
- `expo-linear-gradient`, `@expo/vector-icons`
- Local TypeScript mock data (no backend, no network calls except streaming the placeholder video clips)

## Project structure

```
app/                      Expo Router routes (screens)
  onboarding/  auth/  (tabs)/  series/  player/  wallet/  subscription/  settings/
src/
  components/ui/          Generic reusable components (buttons, sheets, badges, ...)
  components/media/       Content-specific components (posters, rails, video controls)
  features/player/        Player-only pieces (locked-episode overlay, rewarded ad, episode list sheet)
  data/                   Mock series/episode/wallet data
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

```bash
npm install
```

## Running the prototype

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
2. **Sign in** — tap any option (Guest, Email with validation, Google, Apple). All are simulated
   with a short loading state.
3. **Home** — hero carousel, Continue Watching (empty on first run), Trending/New/Recommended/Free/
   Completed rails, genre rails, membership banner. Pull to refresh; note the skeleton loading state
   on first paint.
4. **Discover** — genre chips, free/premium + ongoing/completed + language filters, sort control.
5. **Search** — type a title, genre, or cast name; note the debounce, recent/trending searches, and
   the empty-results state for a nonsense query.
6. **Open a series** (e.g. "Crimson Contract") — synopsis, cast, favourite/share, episode list with
   free/coin/ad-unlock/members badges.
7. **Play episode 1** (free) — tap to pause/resume, swipe up for the next episode, swipe down to go
   back, try the side-rail controls (favourite, share, subtitles, speed, volume), open the episode
   list from the top-right icon.
8. **Swipe or jump to a locked episode** — the paywall sheet appears automatically. Try:
   - **Watch Advertisement** on an ad-unlock episode — 5s simulated ad, close button appears only
     after the countdown, "Reward earned!", episode unlocks.
   - **Unlock for N coins** on a coin-locked episode — success animation, playback begins. Reopen
     the same episode later: it does **not** charge coins again.
   - A members-only episode routes straight to the **Membership** screen.
9. **Wallet** (via the header wallet icon or Profile) — buy a coin package, watch the confirm →
   processing → success flow, see the transaction land in history.
10. **Subscription** — start a membership, see the coin bonus, renewal date, and Premium badge
    appear on Profile.
11. **Library** — Continue Watching, Favourites (remove one), Unlocked Series, Watch History
    (remove an entry).
12. **Profile → Demo Controls** (see below) → **Reset Prototype**, with confirmation — verify it
    drops you back at Onboarding with a clean slate.

## Demo Controls

Profile → scroll to the blue **Demo Controls** panel (only rendered when `__DEV__` is true, i.e.
never in a production build). It exists to make live demos repeatable without manual setup:

- `+500 Coins` / `Remove All Coins`
- `Activate Membership` / `Cancel Membership`
- `Lock All Premium` / `Unlock All Episodes`
- `Clear Viewing History`
- `Reset Entire Prototype` (same confirmation flow as Profile's own Reset Prototype)

A small **PROTOTYPE** badge also appears next to the Profile header in dev builds.

## Mock data

`src/data/seriesData.ts` defines 8 original fictional series (none of the titles, characters, or
artwork are copied from any real product) — a mix of Romance, Suspense, Revenge, Comedy, Fantasy,
Youth, Mystery, and Workplace genres, each with 6–8 episodes. Episode access is deliberately mixed
per series: free, coin-locked (with a price), subscriber-only, and rewarded-ad-unlock.

Posters/banners are **gradient placeholders** (no external images), generated from per-series color
pairs in the data file — this keeps the app fully offline-safe and avoids any image licensing
questions.

Episode video is a small rotating pool of publicly hosted, openly-licensed reference clips
(`src/data/videoSources.ts`): Google's official ExoPlayer/Media3 test-media bucket, the long-standing
W3Schools HTML5 video tutorial clip (Big Buck Bunny, a Blender Foundation CC-BY film), and a
Mozilla-hosted CC0 clip used in MDN's own `<video>` documentation. They're landscape source clips
rendered inside the portrait 9:16 player — in production these would be replaced by real vertically-
shot drama footage on a CDN.

## Known limitations

The following are **simulated only** — none of them talk to a real backend or third-party service:

- **Authentication** — no real accounts, tokens, or passwords; "sign-in" just creates a local mock
  user profile.
- **Payments** — coin purchases and subscriptions never touch a real payment provider; nothing is
  ever charged.
- **Subscriptions** — no App Store/Play Store receipt validation or real recurring billing.
- **Advertisements** — the rewarded ad is a labeled placeholder screen with a countdown, not a real
  ad SDK.
- **Backend content management** — all series/episode/wallet data is local TypeScript, not served
  from a CMS or API.
- **Analytics** — no event tracking of any kind.
- **Push notifications** — the notification toggle in Settings has no delivery mechanism behind it.
- **Secure video delivery** — video is streamed from public reference URLs with no DRM, signed URLs,
  or CDN.

Everything else — navigation, state persistence (AsyncStorage), progress tracking, unlock/paywall
logic, coin math, and UI — runs for real, on-device, and survives app restarts.

## Testing

```bash
npm test
```

Focused Jest tests cover: search filtering, coin deduction, duplicate-unlock prevention, insufficient-
coin handling, favourite toggling, viewing-progress persistence (including the ~90% "watched"
threshold), subscription entitlement, and full prototype reset behavior. See `src/__tests__/`.

```bash
npm run lint        # ESLint (eslint-config-expo)
npm run typecheck    # tsc --noEmit, strict mode
```

## Suggested production roadmap

If this prototype moves toward production:

1. Replace mock auth with a real identity provider (Google/Apple sign-in tokens verified server-side,
   or an email/OTP flow with a real backend).
2. Stand up a CMS/API for series, episodes, and video assets; replace `src/data/*` with fetched data
   and add loading/error states per screen.
3. Integrate a real payment provider (App Store/Play Store IAP for coins and subscriptions, with
   server-side receipt validation) and a real rewarded-ad SDK.
4. Move video to a real CDN with adaptive bitrate streaming and DRM/signed URLs; add original,
   vertically-shot content.
5. Add analytics (funnel tracking through onboarding → paywall → purchase) and push notifications.
6. Add an admin/CMS portal for managing series, episodes, pricing, and promotions.
7. Replace gradient poster/banner placeholders with real artwork and an image CDN.
8. Expand automated test coverage to integration/E2E (Detox or Maestro) alongside the existing unit
   tests, and add CI.
