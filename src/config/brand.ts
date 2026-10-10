/**
 * Central brand configuration — nothing else in the app should hardcode the
 * product name. "Keybox" is the real product name ("DramaRush" was the
 * prototype placeholder).
 */
export const BRAND = {
  name: 'Keybox',
  tagline: 'Stories made for every moment.',
  legalName: 'Keybox',
  scheme: 'keybox',
  supportEmail: 'support@dramarush.app',
  websiteUrl: 'https://dramarush.app',
  currency: {
    coinName: 'Coin',
    coinNamePlural: 'Coins',
    coinSymbol: '🪙',
  },
} as const;

export const IS_PROTOTYPE = true;

// Fallback display names used wherever a profile row hasn't set one yet
// (guest sign-up, or a real account before its profile finishes loading).
// Centralized per the note above — this used to be copy-pasted as a literal
// string in three different files (userStore, AuthListener, the auth
// screen), which is exactly the kind of drift BRAND.name exists to prevent.
export const DEFAULT_GUEST_NAME = 'Guest Viewer';
export const DEFAULT_MEMBER_NAME = `${BRAND.name} Member`;
