import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

export const asyncStorageAdapter = createJSONStorage(() => AsyncStorage);

export const STORAGE_KEYS = {
  user: 'dramarush/user',
  wallet: 'dramarush/wallet',
  subscription: 'dramarush/subscription',
  library: 'dramarush/library',
  search: 'dramarush/search',
  settings: 'dramarush/settings',
} as const;

export async function clearAllPrototypeStorage(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
}
