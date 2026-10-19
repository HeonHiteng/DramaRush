jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'));

import { FunctionsHttpError } from '@supabase/supabase-js';
import {
  __getTable,
  __reset,
  __setAdmin,
  __setBalance,
  __setInvokeHandler,
  __setSimulatedPayments,
  __setUserId,
} from '../testUtils/supabaseMock';
import { supabase } from '@/lib/supabase';
import { useWalletStore } from '@/store/walletStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useUserStore } from '@/store/userStore';
import { clearPlaybackCache, fetchPlayback } from '@/services/playback';
import { fetchCoinPackages, fetchSubscriptionPlans } from '@/services/content';
import type { AuthProvider } from '@/types';

function signInAs(id: string, provider: AuthProvider = 'google') {
  __setUserId(id, { anonymous: provider === 'guest' });
  useUserStore.setState({ user: { id, displayName: 'Tester', provider, avatarSeed: 'Tester', createdAt: '', isAdmin: false } });
}

function walletRow() {
  return __getTable('wallets')[0];
}

describe('backend rules: entitlements are server-side only', () => {
  beforeEach(() => {
    __reset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    signInAs('test-user-1');
    __setBalance('test-user-1', 150);
    useWalletStore.setState({ balance: 150, transactions: [] });
    useLibraryStore.getState().resetLocal();
    useSubscriptionStore.getState().resetLocal();
  });

  afterEach(() => jest.restoreAllMocks());

  it('the client cannot write its own wallet balance', async () => {
    const { error } = await supabase.from('wallets').update({ balance: 99999 }).eq('user_id', 'test-user-1');
    expect(error?.code).toBe('42501');
    expect(walletRow().balance).toBe(150);
  });

  it('the client cannot rewrite the catalog or the config', async () => {
    expect((await supabase.from('coin_packages').update({ coins: 1e6 }).eq('id', 'coins-100')).error?.code).toBe('42501');
    expect((await supabase.from('app_config').update({ value: true }).eq('key', 'simulated_payments')).error?.code).toBe('42501');
  });

  it('shows the new balance right after a coin unlock', async () => {
    await useLibraryStore.getState().unlockEpisodeWithCoins('ep-coin');
    expect(useWalletStore.getState().balance).toBe(130);
  });

  it('a purchase grants exactly what the server-side package says', async () => {
    const [pkg] = await fetchCoinPackages();
    const ok = await useWalletStore.getState().purchasePackage(pkg);
    expect(ok).toBe(true);
    expect(walletRow().balance).toBe(150 + pkg.coins + pkg.bonusCoins);
    expect(useWalletStore.getState().transactions[0]).toMatchObject({ type: 'purchase' });
  });

  it('purchases fail cleanly when simulated payments are switched off', async () => {
    __setSimulatedPayments(false);
    const [pkg] = await fetchCoinPackages();
    const ok = await useWalletStore.getState().purchasePackage(pkg);
    expect(ok).toBe(false);
    expect(walletRow().balance).toBe(150);
  });

  it('membership bonus coins come from the server and show in the wallet', async () => {
    const monthly = (await fetchSubscriptionPlans()).find((p) => p.id === 'monthly')!;
    const ok = await useSubscriptionStore.getState().activate('monthly');
    expect(ok).toBe(true);
    expect(useSubscriptionStore.getState().isActive).toBe(true);
    expect(useWalletStore.getState().balance).toBe(150 + monthly.bonus_coins);
  });

  it('demo controls are refused for non-admin accounts', async () => {
    __setAdmin(false);
    await useWalletStore.getState().demoAddCoins(500);
    expect(walletRow().balance).toBe(150);
    await useLibraryStore.getState().unlockAll();
    expect(__getTable('unlocks')).toHaveLength(0);
  });

  it('demo unlock-all works for admins', async () => {
    await useLibraryStore.getState().unlockAll();
    expect(useLibraryStore.getState().unlockedEpisodeIds.sort()).toEqual(['ep-ad', 'ep-coin', 'ep-member']);
    await useLibraryStore.getState().lockAllPremium();
    expect(useLibraryStore.getState().unlockedEpisodeIds).toHaveLength(0);
  });
});

describe('backend rules: guests must link an account', () => {
  beforeEach(() => {
    __reset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    signInAs('guest-1', 'guest');
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['unlock_episode_with_coins', { p_episode_id: 'ep-coin' }],
    ['redeem_ad_reward', { p_episode_id: 'ep-ad' }],
    ['claim_daily_mission', {}],
    ['simulate_purchase', { p_package_id: 'coins-100' }],
    ['simulate_subscribe', { p_plan_id: 'monthly' }],
  ])('%s raises account_required', async (name, params) => {
    const { data, error } = await supabase.rpc(name, params);
    expect(data).toBeNull();
    expect(error?.message).toBe('account_required');
  });

  it('a guest holds 0 coins and nothing they try changes that', async () => {
    const [pkg] = await fetchCoinPackages();
    await useWalletStore.getState().purchasePackage(pkg);
    await useWalletStore.getState().claimDailyMission();
    await useLibraryStore.getState().redeemAdReward('ep-ad');
    await useSubscriptionStore.getState().activate('annual');
    await useWalletStore.getState().hydrateFromServer();
    expect(useWalletStore.getState().balance).toBe(0);
    expect(useSubscriptionStore.getState().isActive).toBe(false);
    expect(__getTable('unlocks')).toHaveLength(0);
  });

  it('a guest may read the public catalog and config', async () => {
    expect(await fetchCoinPackages()).toHaveLength(4);
    expect(await fetchSubscriptionPlans()).toHaveLength(2);
  });
});

describe('playback service', () => {
  const okResponse = {
    hls_url: 'https://customer-x.cloudflarestream.com/tok/manifest/video.m3u8',
    thumbnail_url: 'https://customer-x.cloudflarestream.com/tok/thumbnails/thumbnail.jpg',
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    watermark_code: 'ABC2345',
  };

  beforeEach(() => clearPlaybackCache());

  it('returns a grant and reuses it while fresh', async () => {
    const calls: unknown[] = [];
    __setInvokeHandler(async (name, body) => {
      calls.push([name, body]);
      return { data: okResponse, error: null };
    });
    const first = await fetchPlayback('ep-free');
    const second = await fetchPlayback('ep-free');
    expect(first).toMatchObject({ ok: true, grant: { hlsUrl: okResponse.hls_url, watermarkCode: 'ABC2345' } });
    expect(first.ok && first.grant.previewSeconds).toBeUndefined();
    expect(second.ok).toBe(true);
    expect(calls).toEqual([['playback-token', { episode_id: 'ep-free' }]]);

    await fetchPlayback('ep-free', { force: true });
    expect(calls).toHaveLength(2);
  });

  it('asks again once the cached grant is about to expire', async () => {
    let n = 0;
    __setInvokeHandler(async () => {
      n++;
      return { data: { ...okResponse, expires_at: new Date(Date.now() + 30_000).toISOString() }, error: null };
    });
    await fetchPlayback('ep-free');
    await fetchPlayback('ep-free');
    expect(n).toBe(2);
  });

  it.each(['not_authenticated', 'not_entitled', 'account_required', 'unavailable', 'rate_limited', 'blocked', 'budget'])(
    'maps the %s error code',
    async (code) => {
      __setInvokeHandler(async () => ({
        data: null,
        error: new FunctionsHttpError({ status: 403, json: async () => ({ error: code }) }),
      }));
      expect(await fetchPlayback('ep-coin')).toEqual({ ok: false, code });
    }
  );

  it('treats unknown errors as server or network errors', async () => {
    __setInvokeHandler(async () => ({ data: null, error: new FunctionsHttpError({ status: 500, json: async () => ({}) }) }));
    expect(await fetchPlayback('ep-coin')).toEqual({ ok: false, code: 'server_error' });
    __setInvokeHandler(async () => ({ data: null, error: new Error('offline') }));
    expect(await fetchPlayback('ep-coin')).toEqual({ ok: false, code: 'network_error' });
  });
});
