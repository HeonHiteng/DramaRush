import { create } from 'zustand';
import type { CoinPackage, Transaction, TransactionType } from '@/types';
import { STARTING_COIN_BALANCE } from '@/data/wallet';
import { supabase } from '@/lib/supabase';

interface WalletState {
  balance: number;
  transactions: Transaction[];
  isHydrated: boolean;

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

  hydrateFromServer: () => Promise<void>;
  resetLocal: () => void;
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
    set({ balance: STARTING_COIN_BALANCE, transactions: [] });
    if (!userId) return;
    await Promise.all([
      supabase
        .from('wallets')
        .update({ balance: STARTING_COIN_BALANCE, updated_at: new Date().toISOString() })
        .eq('user_id', userId),
      supabase.from('transactions').delete().eq('user_id', userId),
    ]);
  },

  hydrateFromServer: async () => {
    const userId = await currentUserId();
    if (!userId) {
      set({ balance: STARTING_COIN_BALANCE, transactions: [], isHydrated: true });
      return;
    }
    const [walletRes, txnRes] = await Promise.all([
      supabase.from('wallets').select('balance').eq('user_id', userId).maybeSingle(),
      supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    ]);
    set({
      balance: walletRes.data?.balance ?? STARTING_COIN_BALANCE,
      transactions: (txnRes.data ?? []).map(toTransaction),
      isHydrated: true,
    });
  },

  resetLocal: () => set({ balance: STARTING_COIN_BALANCE, transactions: [], isHydrated: false }),
}));
