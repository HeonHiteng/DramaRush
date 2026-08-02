import { clearAllPrototypeStorage } from './storage';
import { useUserStore } from './userStore';
import { useWalletStore } from './walletStore';
import { useSubscriptionStore } from './subscriptionStore';
import { useLibraryStore } from './libraryStore';
import { useSearchStore } from './searchStore';
import { useSettingsStore } from './settingsStore';

/** Fully resets every prototype store to its first-launch state. */
export async function resetPrototype(): Promise<void> {
  useUserStore.getState().resetUser();
  useWalletStore.getState().resetWallet();
  useSubscriptionStore.getState().reset();
  useLibraryStore.getState().resetLibrary();
  useSearchStore.getState().clearRecent();
  useSettingsStore.getState().resetSettings();
  await clearAllPrototypeStorage();
}
