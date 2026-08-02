export interface CoinPackage {
  id: string;
  coins: number;
  bonusCoins: number;
  priceLabel: string;
  priceValue: number;
  badge?: string;
}

export type TransactionType = 'purchase' | 'unlock' | 'bonus' | 'reward' | 'reset';

export interface Transaction {
  id: string;
  type: TransactionType;
  label: string;
  amount: number;
  timestamp: string;
}

export interface SubscriptionPlan {
  id: 'monthly' | 'annual';
  title: string;
  priceLabel: string;
  periodLabel: string;
  bestValue?: boolean;
  monthlyEquivalentLabel?: string;
  bonusCoins: number;
}
