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

export const STORAGE_KEYS = {
  user: 'keybox/user',
  wallet: 'keybox/wallet',
  subscription: 'keybox/subscription',
  library: 'keybox/library',
  search: 'keybox/search',
  settings: 'keybox/settings',
} as const;

export async function clearAllPrototypeStorage(): Promise<void> {
  const keys = Object.values(STORAGE_KEYS);
  await AsyncStorage.multiRemove([...keys, ...keys.map((k) => legacyName(k)!)]);
}
