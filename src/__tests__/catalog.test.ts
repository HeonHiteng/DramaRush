jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'));

import { __reset, __setConfig, __setQueryError } from '../testUtils/supabaseMock';
import {
  billingPeriodOf,
  DEFAULT_PUBLIC_CONFIG,
  fetchCoinPackages,
  fetchPublicConfig,
  fetchSubscriptionPlans,
  mapPublicConfig,
  mapSubscriptionPlan,
} from '@/services/content';
import { translations } from '@/i18n/translations';

const t = (key: keyof (typeof translations)['en'], vars?: Record<string, string | number>) =>
  Object.entries(vars ?? {}).reduce<string>((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), translations.en[key]);

describe('wallet catalog from the database', () => {
  beforeEach(() => __reset());

  it('maps coin_packages rows to the packages the wallet shows', async () => {
    expect(await fetchCoinPackages()).toEqual([
      { id: 'coins-100', coins: 100, bonusCoins: 0, priceLabel: '$0.99', priceValue: 0.99 },
      { id: 'coins-250', coins: 250, bonusCoins: 25, priceLabel: '$2.99', priceValue: 2.99, badge: '+10% bonus' },
      { id: 'coins-600', coins: 600, bonusCoins: 90, priceLabel: '$6.99', priceValue: 6.99, badge: '+15% bonus' },
      { id: 'coins-1500', coins: 1500, bonusCoins: 300, priceLabel: '$14.99', priceValue: 14.99, badge: '+20% bonus' },
    ]);
  });

  it('maps subscription_plans rows, labelling the billing period', async () => {
    const plans = (await fetchSubscriptionPlans()).map((row) => mapSubscriptionPlan(row, t));
    expect(plans).toEqual([
      { id: 'monthly', period: 'monthly', title: 'Monthly Membership', priceLabel: '$8.99', periodLabel: '/ month', bonusCoins: 100 },
      {
        id: 'annual',
        period: 'annual',
        title: 'Annual Membership',
        priceLabel: '$59.99',
        periodLabel: '/ year',
        bestValue: true,
        monthlyEquivalentLabel: 'equivalent to $5.00/mo',
        bonusCoins: 1500,
      },
    ]);
  });

  it.each([
    ['1 mon', 'monthly'],
    ['1 month', 'monthly'],
    ['30 days', 'monthly'],
    ['P1M', 'monthly'],
    ['1 year', 'annual'],
    ['2 years', 'annual'],
    ['P1Y', 'annual'],
    ['365 days', 'annual'],
  ])('reads the interval %s as %s', (interval, period) => {
    expect(billingPeriodOf(interval)).toBe(period);
  });

  it('reads the public app_config switches', async () => {
    __setConfig('simulated_payments', false);
    __setConfig('daily_mission_reward', 25);
    expect(await fetchPublicConfig()).toEqual({
      simulatedPayments: false,
      dailyMissionReward: 25,
      adUnlocksPerDay: 20,
      welcomeBonusCoins: 150,
    });
  });

  it('falls back to defaults only for keys the server did not send', () => {
    expect(mapPublicConfig([{ key: 'simulated_payments', value: 'false' }, { key: 'unknown', value: 1 }])).toEqual({
      ...DEFAULT_PUBLIC_CONFIG,
      simulatedPayments: false,
    });
  });

  it('surfaces a failed read to react-query instead of an empty catalog', async () => {
    __setQueryError('coin_packages', { message: 'offline' });
    await expect(fetchCoinPackages()).rejects.toMatchObject({ message: 'offline' });
  });
});
