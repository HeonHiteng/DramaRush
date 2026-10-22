jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'));

import { __getTable, __reset, __setUserId, supabase } from '../testUtils/supabaseMock';
import { clearPlaybackCache, fetchPlayback } from '@/services/playback';

afterEach(() => jest.restoreAllMocks());

describe('playback-token for guests', () => {
  beforeEach(() => {
    __reset();
    clearPlaybackCache();
    __setUserId('guest-1', { anonymous: true });
  });

  it("gives a full grant for a free episode, cached like anyone else's", async () => {
    const invoke = jest.spyOn(supabase.functions, 'invoke');
    const result = await fetchPlayback('ep-free');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.grant).not.toHaveProperty('previewSeconds');
    expect((result.grant.expiresAt - Date.now()) / 60_000).toBeGreaterThan(14);
    await fetchPlayback('ep-free');
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('answers not_entitled for an ad episode until the guest unlocks it with an ad', async () => {
    expect(await fetchPlayback('ep-ad')).toEqual({ ok: false, code: 'not_entitled' });
    await supabase.rpc('redeem_ad_reward', { p_episode_id: 'ep-ad' });
    expect((await fetchPlayback('ep-ad')).ok).toBe(true);
  });

  it.each(['ep-coin', 'ep-member'])('answers account_required for the coin / member episode %s', async (episodeId) => {
    expect(await fetchPlayback(episodeId)).toEqual({ ok: false, code: 'account_required' });
  });
});

describe('playback-token for members', () => {
  beforeEach(() => {
    __reset();
    clearPlaybackCache();
    __setUserId('test-user-1', { anonymous: false });
  });

  it('full grants are cached', async () => {
    const invoke = jest.spyOn(supabase.functions, 'invoke');
    const first = await fetchPlayback('ep-free');
    await fetchPlayback('ep-free');
    expect(first.ok).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('locked episodes are not_entitled (paywall), unlocked ones play', async () => {
    expect(await fetchPlayback('ep-coin')).toEqual({ ok: false, code: 'not_entitled' });
    __getTable('unlocks').push({ user_id: 'test-user-1', episode_id: 'ep-coin' });
    expect((await fetchPlayback('ep-coin')).ok).toBe(true);
  });

  it('a signed-out caller gets not_authenticated', async () => {
    __setUserId(null);
    expect(await fetchPlayback('ep-free')).toEqual({ ok: false, code: 'not_authenticated' });
  });
});
