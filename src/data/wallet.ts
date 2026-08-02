import type { CoinPackage, SubscriptionPlan } from '@/types';

export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'coins-100', coins: 100, bonusCoins: 0, priceLabel: '$0.99', priceValue: 0.99 },
  {
    id: 'coins-250',
    coins: 250,
    bonusCoins: 25,
    priceLabel: '$2.99',
    priceValue: 2.99,
    badge: '+10% bonus',
  },
  {
    id: 'coins-600',
    coins: 600,
    bonusCoins: 90,
    priceLabel: '$6.99',
    priceValue: 6.99,
    badge: '+15% bonus',
  },
  {
    id: 'coins-1500',
    coins: 1500,
    bonusCoins: 300,
    priceLabel: '$14.99',
    priceValue: 14.99,
    badge: '+20% bonus',
  },
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'monthly',
    title: 'Monthly Membership',
    priceLabel: '$8.99',
    periodLabel: '/ month',
    bonusCoins: 100,
  },
  {
    id: 'annual',
    title: 'Annual Membership',
    priceLabel: '$59.99',
    periodLabel: '/ year',
    bestValue: true,
    monthlyEquivalentLabel: 'equivalent to $5.00/mo',
    bonusCoins: 1500,
  },
];

export const STARTING_COIN_BALANCE = 150;
