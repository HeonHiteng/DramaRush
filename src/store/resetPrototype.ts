import { supabase } from '@/lib/supabase';
import { clearAllPrototypeStorage } from './storage';
import { useUserStore } from './userStore';
import { useLibraryStore } from './libraryStore';
import { useWalletStore } from './walletStore';
import { useSubscriptionStore } from './subscriptionStore';
import { useSearchStore } from './searchStore';
import { useSettingsStore } from './settingsStore';

/**
 * Fully resets the prototype: clears the signed-in user's server-side data
 * (favorites, unlocks, history, progress, coin balance, transactions,
 * subscription, recent searches) via the reset_my_data() RPC, signs them out
 * of Supabase, and clears device-local state (onboarding flag,
 * playback/notification settings).
 */
export async function resetPrototype(): Promise<void> {
  // Must run while still authenticated. The server refuses once simulated
  // payments are switched off (launch builds) — then only local state resets.
  const { error } = await supabase.rpc('reset_my_data');
  if (error) console.warn('reset_my_data failed', error);

  useLibraryStore.getState().resetLocal();
  useWalletStore.getState().resetLocal();
  useSubscriptionStore.getState().resetLocal();
  useSearchStore.getState().resetLocal();

  await useUserStore.getState().signOut();
  useUserStore.setState({ hasOnboarded: false });
  useSettingsStore.getState().resetSettings();

  await clearAllPrototypeStorage();
}
