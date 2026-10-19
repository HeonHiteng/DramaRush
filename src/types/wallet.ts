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

/** How often a membership renews, derived from subscription_plans.billing_period. */
export type BillingPeriod = 'monthly' | 'annual';

export interface SubscriptionPlan {
  /** subscription_plans.id — what simulate_subscribe() takes ('monthly' / 'annual' today). */
  id: string;
  period: BillingPeriod;
  title: string;
  priceLabel: string;
  periodLabel: string;
  bestValue?: boolean;
  monthlyEquivalentLabel?: string;
  bonusCoins: number;
}

/** The public app_config rows (DramaRush-Backend docs/frontend-api.md §4). */
export interface PublicConfig {
  /** False once real store billing replaces the simulated purchase buttons. */
  simulatedPayments: boolean;
  dailyMissionReward: number;
  adUnlocksPerDay: number;
  welcomeBonusCoins: number;
  guestPreviewSeconds: number;
  guestPreviewsPerDay: number;
}

/** Outcome of redeem_ad_reward(), so the player can say why nothing unlocked. */
export type AdRewardResult = 'unlocked' | 'cap_reached' | 'account_required' | 'failed';
