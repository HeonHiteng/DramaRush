import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { asyncStorageAdapter, STORAGE_KEYS } from './storage';
import { DEFAULT_LANGUAGE, type LanguageCode } from '@/i18n/translations';

export type PlaybackQuality = 'auto' | '480p' | '720p' | '1080p';

/** Closing the Home "link your account" banner hides it this long. */
export const LINK_BANNER_SNOOZE_MS = 24 * 60 * 60 * 1000;

interface SettingsState {
  notificationsEnabled: boolean;
  autoplayNextEpisode: boolean;
  subtitlesEnabled: boolean;
  playbackQuality: PlaybackQuality;
  language: LanguageCode;
  reducedMotion: boolean;
  /** When the guest last closed the Home link banner (ms), per device. */
  linkBannerDismissedAt: number | null;
  /**
   * In memory only (not persisted): the banner was closed during this run of
   * the app — so it appears at most once per cold start, and doesn't pop
   * back mid-session when the 24 h are up while the app is still open.
   */
  linkBannerClosedThisLaunch: boolean;
  setNotificationsEnabled: (v: boolean) => void;
  setAutoplayNextEpisode: (v: boolean) => void;
  setSubtitlesEnabled: (v: boolean) => void;
  setPlaybackQuality: (v: PlaybackQuality) => void;
  setLanguage: (v: LanguageCode) => void;
  setReducedMotion: (v: boolean) => void;
  dismissLinkBanner: () => void;
  resetSettings: () => void;
}

const DEFAULTS = {
  notificationsEnabled: true,
  autoplayNextEpisode: true,
  subtitlesEnabled: false,
  playbackQuality: 'auto' as PlaybackQuality,
  language: DEFAULT_LANGUAGE,
  reducedMotion: false,
};

type LinkBannerState = Pick<SettingsState, 'linkBannerDismissedAt' | 'linkBannerClosedThisLaunch'>;

/**
 * Whether the Home link banner may show (the caller also checks that the user
 * is a guest): not after it was closed this launch, and not within 24 h of
 * the last close. A close time in the future (the clock was turned back)
 * doesn't keep it hidden.
 */
export function shouldShowLinkBanner(state: LinkBannerState, now: number): boolean {
  if (state.linkBannerClosedThisLaunch) return false;
  if (state.linkBannerDismissedAt === null) return true;
  const elapsed = now - state.linkBannerDismissedAt;
  return elapsed < 0 || elapsed >= LINK_BANNER_SNOOZE_MS;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      linkBannerDismissedAt: null,
      linkBannerClosedThisLaunch: false,
      setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),
      setAutoplayNextEpisode: (v) => set({ autoplayNextEpisode: v }),
      setSubtitlesEnabled: (v) => set({ subtitlesEnabled: v }),
      setPlaybackQuality: (v) => set({ playbackQuality: v }),
      setLanguage: (v) => set({ language: v }),
      setReducedMotion: (v) => set({ reducedMotion: v }),
      dismissLinkBanner: () => set({ linkBannerDismissedAt: Date.now(), linkBannerClosedThisLaunch: true }),
      resetSettings: () => set({ ...DEFAULTS }),
    }),
    {
      name: STORAGE_KEYS.settings,
      storage: asyncStorageAdapter,
      partialize: ({ linkBannerClosedThisLaunch: _closedThisLaunch, ...persisted }) => persisted,
    }
  )
);
