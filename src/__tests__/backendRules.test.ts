jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'));

import { FunctionsHttpError } from '@supabase/supabase-js';
import { __getTable, __reset, __setAdmin, __setInvokeHandler, __setSimulatedPayments } from '../testUtils/supabaseMock';
import { supabase } from '@/lib/supabase';
import { useWalletStore } from '@/store/walletStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { clearPlaybackCache, fetchPlayback } from '@/services/playback';
import { COIN_PACKAGES, STARTING_COIN_BALANCE, SUBSCRIPTION_PLANS } from '@/data/wallet';

function walletRow() {
  return __getTable('wallets')[0];
}

describe('backend rules: entitlements are server-side only', () => {
  beforeEach(() => {
    __reset();
    useWalletStore.setState({ balance: STARTING_COIN_BALANCE, transactions: [] });
    useLibraryStore.setState({ favoriteSeriesIds: [], unlockedEpisodeIds: [], history: [], progress: {} });
    useSubscriptionStore.setState({ isActive: false, planId: null, startedAt: null, renewsAt: null });
  });

  it('the client cannot write its own wallet balance', async () => {
    const { error } = await supabase.from('wallets').update({ balance: 99999 }).eq('user_id', 'test-user-1');
    expect(error?.code).toBe('42501');
    expect(walletRow().balance).toBe(STARTING_COIN_BALANCE);
  });

  it('shows the new balance right after a coin unlock', async () => {
    await useLibraryStore.getState().unlockEpisodeWithCoins('ep-coin');
    expect(useWalletStore.getState().balance).toBe(STARTING_COIN_BALANCE - 20);
  });

  it('a purchase grants exactly what the server-side package says', async () => {
    const pkg = COIN_PACKAGES[0];
    const ok = await useWalletStore.getState().purchasePackage(pkg);
    expect(ok).toBe(true);
    expect(walletRow().balance).toBe(STARTING_COIN_BALANCE + pkg.coins + pkg.bonusCoins);
    expect(useWalletStore.getState().transactions[0]).toMatchObject({ type: 'purchase' });
  });

  it('purchases fail cleanly when simulated payments are switched off', async () => {
    __setSimulatedPayments(false);
    const ok = await useWalletStore.getState().purchasePackage(COIN_PACKAGES[0]);
    expect(ok).toBe(false);
    expect(walletRow().balance).toBe(STARTING_COIN_BALANCE);
  });

  it('membership bonus coins come from the server and show in the wallet', async () => {
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === 'monthly')!;
    const ok = await useSubscriptionStore.getState().activate('monthly');
    expect(ok).toBe(true);
    expect(useSubscriptionStore.getState().isActive).toBe(true);
    expect(useWalletStore.getState().balance).toBe(STARTING_COIN_BALANCE + plan.bonusCoins);
  });

  it('demo controls are refused for non-admin accounts', async () => {
    __setAdmin(false);
    await useWalletStore.getState().demoAddCoins(500);
    expect(walletRow().balance).toBe(STARTING_COIN_BALANCE);
    await useLibraryStore.getState().unlockAll();
    expect(__getTable('unlocks')).toHaveLength(0);
  });

  it('demo unlock-all works for admins', async () => {
    await useLibraryStore.getState().unlockAll();
    expect(useLibraryStore.getState().unlockedEpisodeIds.sort()).toEqual(['ep-ad', 'ep-coin']);
    await useLibraryStore.getState().lockAllPremium();
    expect(useLibraryStore.getState().unlockedEpisodeIds).toHaveLength(0);
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

  it.each(['not_entitled', 'unavailable', 'rate_limited', 'blocked', 'budget'])('maps the %s error code', async (code) => {
    __setInvokeHandler(async () => ({
      data: null,
      error: new FunctionsHttpError({ status: 403, json: async () => ({ error: code }) }),
    }));
    expect(await fetchPlayback('ep-coin')).toEqual({ ok: false, code });
  });

  it('treats unknown errors as server or network errors', async () => {
    __setInvokeHandler(async () => ({ data: null, error: new FunctionsHttpError({ status: 500, json: async () => ({}) }) }));
    expect(await fetchPlayback('ep-coin')).toEqual({ ok: false, code: 'server_error' });
    __setInvokeHandler(async () => ({ data: null, error: new Error('offline') }));
    expect(await fetchPlayback('ep-coin')).toEqual({ ok: false, code: 'network_error' });
  });
});
