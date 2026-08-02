import { clearAllPrototypeStorage } from './storage';
import { useUserStore } from './userStore';
import { useWalletStore } from './walletStore';
import { useSubscriptionStore } from './subscriptionStore';
import { useLibraryStore } from './libraryStore';
import { useSearchStore } from './searchStore';
import { useSettingsStore } from './settingsStore';

/**
 * Fully resets the prototype: clears the signed-in user's server-side data
 * (favorites, unlocks, history, progress, coin balance, transactions,
 * subscription, recent searches), signs them out of Supabase, and clears
 * device-local state (onboarding flag, playback/notification settings).
 */
export async function resetPrototype(): Promise<void> {
  // Clear server-side rows while still authenticated — these all resolve
  // the current user id internally and are no-ops once signed out.
  await Promise.all([
    useLibraryStore.getState().resetServerData(),
    useWalletStore.getState().resetWallet(),
    useSubscriptionStore.getState().cancel(),
    useSearchStore.getState().clearRecent(),
  ]);

  await useUserStore.getState().signOut();
  useUserStore.setState({ hasOnboarded: false });
  useSettingsStore.getState().resetSettings();

  await clearAllPrototypeStorage();
}
