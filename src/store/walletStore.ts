import { create } from 'zustand';
import type { CoinPackage, Transaction, TransactionType } from '@/types';
import { STARTING_COIN_BALANCE } from '@/data/wallet';
import { supabase } from '@/lib/supabase';

interface WalletState {
  balance: number;
  transactions: Transaction[];
  isHydrated: boolean;
  dailyMissionClaimedToday: boolean;

  /** Bonus/manual coin grants (Demo Controls, subscription bonus). Writes through to Supabase. */
  addCoins: (amount: number, label: string, type?: TransactionType) => Promise<void>;
  /**
   * Still-simulated purchase trigger (no real payment processor yet — see
   * DramaRush-Backend README "Non-goals") — but the resulting balance and
   * transaction are real, persisted rows.
   */
  purchasePackage: (pkg: CoinPackage) => Promise<void>;
  /** Demo Controls "Remove All Coins". */
  setBalance: (amount: number) => Promise<void>;
  /** Reset Prototype. */
  resetWallet: () => Promise<void>;
  /**
   * Calls the claim_daily_mission() RPC after the rewarded-ad simulation
   * completes. Returns the coins awarded, or 0 if already claimed today —
   * the database (not this client) is the source of truth for that.
   */
  claimDailyMission: () => Promise<number>;

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

  addCoins: async (amount, label, type = 'bonus') => {
    const userId = await currentUserId();
    if (!userId) return;
    const newBalance = get().balance + amount;
    const { data: txn, error: txnError } = await supabase
      .from('transactions')
      .insert({ user_id: userId, type, label, amount })
      .select()
      .single();
    if (txnError) {
      console.warn('addCoins transaction insert failed', txnError);
      return;
    }
    const { error: balanceError } = await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (balanceError) {
      console.warn('addCoins balance update failed', balanceError);
      return;
    }
    set((state) => ({ balance: newBalance, transactions: [toTransaction(txn), ...state.transactions] }));
  },

  purchasePackage: async (pkg) => {
    const total = pkg.coins + pkg.bonusCoins;
    await get().addCoins(total, `Purchased ${pkg.coins} coins (${pkg.priceLabel})`, 'purchase');
  },

  setBalance: async (amount) => {
    const userId = await currentUserId();
    set({ balance: amount });
    if (userId) {
      await supabase.from('wallets').update({ balance: amount, updated_at: new Date().toISOString() }).eq('user_id', userId);
    }
  },

  resetWallet: async () => {
    const userId = await currentUserId();
    set({ balance: STARTING_COIN_BALANCE, transactions: [], dailyMissionClaimedToday: false });
    if (!userId) return;
    await Promise.all([
      supabase
        .from('wallets')
        .update({ balance: STARTING_COIN_BALANCE, updated_at: new Date().toISOString() })
        .eq('user_id', userId),
      supabase.from('transactions').delete().eq('user_id', userId),
      supabase.from('daily_mission_claims').delete().eq('user_id', userId),
    ]);
  },

  claimDailyMission: async () => {
    const { data, error } = await supabase.rpc('claim_daily_mission');
    if (error) {
      console.warn('claimDailyMission failed', error);
      return 0;
    }
    const awarded = data ?? 0;
    if (awarded > 0) {
      const txn: Transaction = {
        id: `daily-mission-${Date.now()}`,
        type: 'reward',
        label: 'Daily mission: watched a rewarded ad',
        amount: awarded,
        timestamp: new Date().toISOString(),
      };
      set((state) => ({
        balance: state.balance + awarded,
        dailyMissionClaimedToday: true,
        transactions: [txn, ...state.transactions],
      }));
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
      balance: walletRes.data?.balance ?? STARTING_COIN_BALANCE,
      transactions: (txnRes.data ?? []).map(toTransaction),
      dailyMissionClaimedToday: !!missionRes.data,
      isHydrated: true,
    });
  },

  resetLocal: () => set({ balance: STARTING_COIN_BALANCE, transactions: [], dailyMissionClaimedToday: false, isHydrated: false }),
}));
