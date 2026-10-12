import { create } from 'zustand';
import type { CoinPackage, Transaction, TransactionType } from '@/types';
import { STARTING_COIN_BALANCE } from '@/data/wallet';
import { supabase } from '@/lib/supabase';

interface WalletState {
  balance: number;
  transactions: Transaction[];
  isHydrated: boolean;
  dailyMissionClaimedToday: boolean;

  /**
   * Still-simulated purchase (no real payment processor yet). The server's
   * simulate_purchase() RPC decides how many coins the package grants and
   * writes the transaction; the app only names the package. Returns false if
   * the server refused (e.g. simulated payments switched off).
   */
  purchasePackage: (pkg: CoinPackage) => Promise<boolean>;
  /** Demo Controls "+N coins" — admin accounts only (demo_set_balance RPC). */
  demoAddCoins: (amount: number) => Promise<void>;
  /** Demo Controls "Remove All Coins" — admin accounts only. */
  setBalance: (amount: number) => Promise<void>;
  /**
   * Calls the claim_daily_mission() RPC after the rewarded-ad simulation
   * completes. Returns the coins awarded, or 0 if already claimed today —
   * the database (not this client) is the source of truth for that.
   */
  claimDailyMission: () => Promise<number>;

  /** Re-reads balance, transactions and today's mission state from the server. */
  hydrateFromServer: () => Promise<void>;
  resetLocal: () => void;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function currentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function toTransaction(row: { id: string; type: TransactionType; label: string; amount: number; created_at: string }): Transaction {
  return { id: row.id, type: row.type, label: row.label, amount: row.amount, timestamp: row.created_at };
}

export const useWalletStore = create<WalletState>()((set, get) => ({
  balance: STARTING_COIN_BALANCE,
  transactions: [],
  isHydrated: false,
  dailyMissionClaimedToday: false,

  purchasePackage: async (pkg) => {
    const { data, error } = await supabase.rpc('simulate_purchase', { p_package_id: pkg.id });
    if (error) {
      console.warn('purchasePackage failed', error);
      return false;
    }
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
    if (awarded > 0) {
      set({ dailyMissionClaimedToday: true });
      await get().hydrateFromServer();
    }
    return awarded;
  },

  hydrateFromServer: async () => {
    const userId = await currentUserId();
    if (!userId) {
      set({ balance: STARTING_COIN_BALANCE, transactions: [], dailyMissionClaimedToday: false, isHydrated: true });
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
    set({
      balance: walletRes.data?.balance ?? get().balance,
      transactions: (txnRes.data ?? []).map(toTransaction),
      dailyMissionClaimedToday: !!missionRes.data,
      isHydrated: true,
    });
  },

  resetLocal: () => set({ balance: STARTING_COIN_BALANCE, transactions: [], dailyMissionClaimedToday: false, isHydrated: false }),
}));
