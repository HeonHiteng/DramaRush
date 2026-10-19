import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

const PREFIX = 'keybox/';
/** Keys were "dramarush/…" before the Keybox rename; moved over on first read. */
const LEGACY_PREFIX = 'dramarush/';

const legacyName = (name: string) => (name.startsWith(PREFIX) ? LEGACY_PREFIX + name.slice(PREFIX.length) : null);

export const keyboxStorage: StateStorage = {
  getItem: async (name) => {
    const value = await AsyncStorage.getItem(name);
    const legacy = legacyName(name);
    if (value !== null || !legacy) return value;
    const old = await AsyncStorage.getItem(legacy);
    if (old !== null) {
      await AsyncStorage.setItem(name, old);
      await AsyncStorage.removeItem(legacy);
    }
    return old;
  },
  setItem: (name, value) => AsyncStorage.setItem(name, value),
  removeItem: (name) => AsyncStorage.removeItem(name),
};

export const asyncStorageAdapter = createJSONStorage(() => keyboxStorage);

/** Only what actually lives on the device. Wallet, subscription, library and
 * search are server data (hydrated by AuthListener), so they have no key. */
export const STORAGE_KEYS = {
  user: 'keybox/user',
  settings: 'keybox/settings',
  /** Set just before a web Google-link redirect so /auth/callback, on a fresh
   * page load with an empty store, knows the round trip was a guest bind. */
  oauthLink: 'keybox/oauth-link',
} as const;

/** Keys earlier builds persisted locally before those stores moved to the
 * server; removed on reset so an old install doesn't keep stale copies. */
const RETIRED_KEYS = ['wallet', 'subscription', 'library', 'search'].flatMap((name) => [PREFIX + name, LEGACY_PREFIX + name]);

export async function clearAllPrototypeStorage(): Promise<void> {
  const keys = Object.values(STORAGE_KEYS);
  await AsyncStorage.multiRemove([...keys, ...keys.map((k) => legacyName(k)!), ...RETIRED_KEYS]);
}
