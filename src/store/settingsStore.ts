import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { asyncStorageAdapter, STORAGE_KEYS } from './storage';
import { DEFAULT_LANGUAGE, type LanguageCode } from '@/i18n/translations';

export type PlaybackQuality = 'auto' | '480p' | '720p' | '1080p';

interface SettingsState {
  notificationsEnabled: boolean;
  autoplayNextEpisode: boolean;
  subtitlesEnabled: boolean;
  playbackQuality: PlaybackQuality;
  language: LanguageCode;
  reducedMotion: boolean;
  setNotificationsEnabled: (v: boolean) => void;
  setAutoplayNextEpisode: (v: boolean) => void;
  setSubtitlesEnabled: (v: boolean) => void;
  setPlaybackQuality: (v: PlaybackQuality) => void;
  setLanguage: (v: LanguageCode) => void;
  setReducedMotion: (v: boolean) => void;
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

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),
      setAutoplayNextEpisode: (v) => set({ autoplayNextEpisode: v }),
      setSubtitlesEnabled: (v) => set({ subtitlesEnabled: v }),
      setPlaybackQuality: (v) => set({ playbackQuality: v }),
      setLanguage: (v) => set({ language: v }),
      setReducedMotion: (v) => set({ reducedMotion: v }),
      resetSettings: () => set({ ...DEFAULTS }),
    }),
    {
      name: STORAGE_KEYS.settings,
      storage: asyncStorageAdapter,
    }
  )
);
