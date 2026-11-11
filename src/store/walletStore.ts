import { create } from 'zustand';
import type { CoinPackage, Transaction, TransactionType } from '@/types';
import { supabase } from '@/lib/supabase';
import { useUserStore } from './userStore';

interface WalletState {
  /** Server balance. Every account starts at 0 (the welcome bonus is paid server-side once a real identity is linked). */
  balance: number;
  transactions: Transaction[];
  isHydrated: boolean;
  dailyMissionClaimedToday: boolean;
  /** Message of the last failed hydrate (the previous data is kept), or null. */
  hydrateError: string | null;
  /** Epoch ms of the last successful hydrate, for refreshIfStale(). */
  lastHydratedAt: number | null;

  /**
   * Still-simulated purchase (no real payment processor yet). The server's
   * simulate_purchase() RPC decides how many coins the package grants and
   * writes the transaction; the app only names the package. Returns false if
   * the server refused (guest account, simulated payments switched off, …).
   */
  purchasePackage: (pkg: CoinPackage) => Promise<boolean>;
  /** Demo Controls "+N coins" — admin accounts only (demo_set_balance RPC). */
  demoAddCoins: (amount: number) => Promise<void>;
  /** Demo Controls "Remove All Coins" — admin accounts only. */
  setBalance: (amount: number) => Promise<void>;
  /**
   * Calls the claim_daily_mission() RPC after the rewarded-ad simulation
   * completes. Returns the coins awarded, or 0 if nothing was paid: either
   * today's reward was already claimed (possibly on another device — then
   * `dailyMissionClaimedToday` is set) or the call failed.
   */
  claimDailyMission: () => Promise<number>;

  /** Re-reads balance, transactions and today's mission state from the server. */
  hydrateFromServer: () => Promise<void>;
  /** hydrateFromServer() unless the last successful one is younger than `maxAgeMs`. */
  refreshIfStale: (maxAgeMs: number) => Promise<void>;
  resetLocal: () => void;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The signed-in user as AuthListener last saw it — no auth network call. */
function currentUserId(): string | null {
  return useUserStore.getState().user?.id ?? null;
}

function toTransaction(row: { id: string; type: TransactionType; label: string; amount: number; created_at: string }): Transaction {
  return { id: row.id, type: row.type, label: row.label, amount: row.amount, timestamp: row.created_at };
}

const EMPTY_STATE = {
  balance: 0,
  transactions: [] as Transaction[],
  dailyMissionClaimedToday: false,
  hydrateError: null as string | null,
  lastHydratedAt: null as number | null,
};

export const useWalletStore = create<WalletState>()((set, get) => ({
  ...EMPTY_STATE,
  isHydrated: false,

  purchasePackage: async (pkg) => {
    const userId = currentUserId();
    const { data, error } = await supabase.rpc('simulate_purchase', { p_package_id: pkg.id });
    if (error) {
      console.warn('purchasePackage failed', error);
      return false;
    }
    if (currentUserId() !== userId) return true;
    set({ balance: data as number });
    await get().hydrateFromServer();
    return true;
  },

  demoAddCoins: async (amount) => {
    await get().setBalance(get().balance + amount);
  },

  setBalance: async (amount) => {
    const { error } = await supabase.rpc('demo_set_balance', { p_balance: amount });
    if (error) {
      console.warn('setBalance failed (admin accounts only)', error);
      return;
    }
    await get().hydrateFromServer();
  },

  claimDailyMission: async () => {
    const { data, error } = await supabase.rpc('claim_daily_mission');
    if (error) {
      console.warn('claimDailyMission failed', error);
      return 0;
    }
    const awarded = (data as number | null) ?? 0;
    // 0 without an error means the server already has today's claim —
    // perhaps from another device — so the mission is done either way.
    set({ dailyMissionClaimedToday: true });
    await get().hydrateFromServer();
    return awarded;
  },

  hydrateFromServer: async () => {
    const userId = currentUserId();
    if (!userId) {
      set({ ...EMPTY_STATE, isHydrated: true });
      return;
    }
    const [walletRes, txnRes, missionRes] = await Promise.all([
      supabase.from('wallets').select('balance').eq('user_id', userId).maybeSingle(),
      supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
      supabase
        .from('daily_mission_claims')
        .select('claim_date')
        .eq('user_id', userId)
        .eq('claim_date', todayIsoDate())
        .maybeSingle(),
    ]);
    // Another account signed in while these were in flight: they describe
    // the previous one, so they must not land in the store.
    if (currentUserId() !== userId) return;

    const error = walletRes.error ?? txnRes.error ?? missionRes.error;
    if (error) console.warn('wallet hydrate failed', error);
    // A failed read keeps what was there: a blip must not show 0 coins or
    // an empty history.
    set({
      ...(walletRes.error ? null : { balance: walletRes.data?.balance ?? 0 }),
      ...(txnRes.error ? null : { transactions: (txnRes.data ?? []).map(toTransaction) }),
      ...(missionRes.error ? null : { dailyMissionClaimedToday: !!missionRes.data }),
      hydrateError: error ? String(error.message ?? error) : null,
      ...(error ? null : { lastHydratedAt: Date.now() }),
      isHydrated: true,
    });
  },

  refreshIfStale: async (maxAgeMs) => {
    const last = get().lastHydratedAt;
    if (last !== null && Date.now() - last < maxAgeMs) return;
    await get().hydrateFromServer();
  },

  resetLocal: () => set({ ...EMPTY_STATE, isHydrated: false }),
}));
