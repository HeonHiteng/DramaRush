import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CoinPackage, Transaction, TransactionType } from '@/types';
import { STARTING_COIN_BALANCE } from '@/data/wallet';
import { asyncStorageAdapter, STORAGE_KEYS } from './storage';

interface WalletState {
  balance: number;
  transactions: Transaction[];
  addCoins: (amount: number, label: string, type?: TransactionType) => void;
  spendCoins: (amount: number, label: string) => boolean;
  purchasePackage: (pkg: CoinPackage) => void;
  resetWallet: () => void;
  setBalance: (amount: number) => void;
}

function makeTransaction(type: TransactionType, label: string, amount: number): Transaction {
  return {
    id: `txn-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    type,
    label,
    amount,
    timestamp: new Date().toISOString(),
  };
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      balance: STARTING_COIN_BALANCE,
      transactions: [],
      addCoins: (amount, label, type = 'bonus') =>
        set((state) => ({
          balance: state.balance + amount,
          transactions: [makeTransaction(type, label, amount), ...state.transactions],
        })),
      spendCoins: (amount, label) => {
        const { balance } = get();
        if (balance < amount) return false;
        set((state) => ({
          balance: state.balance - amount,
          transactions: [makeTransaction('unlock', label, -amount), ...state.transactions],
        }));
        return true;
      },
      purchasePackage: (pkg) => {
        const total = pkg.coins + pkg.bonusCoins;
        set((state) => ({
          balance: state.balance + total,
          transactions: [
            makeTransaction('purchase', `Purchased ${pkg.coins} coins (${pkg.priceLabel})`, total),
            ...state.transactions,
          ],
        }));
      },
      setBalance: (amount) => set({ balance: amount }),
      resetWallet: () =>
        set({
          balance: STARTING_COIN_BALANCE,
          transactions: [makeTransaction('reset', 'Prototype reset', 0)],
        }),
    }),
    {
      name: STORAGE_KEYS.wallet,
      storage: asyncStorageAdapter,
    }
  )
);
