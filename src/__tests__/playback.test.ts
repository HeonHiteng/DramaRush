jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'));

import { __getTable, __reset, __setConfig, __setUserId, supabase } from '../testUtils/supabaseMock';
import { clearPlaybackCache, fetchPlayback, isGrantFresh } from '@/services/playback';

afterEach(() => jest.restoreAllMocks());

describe('playback-token for guests (previews)', () => {
  beforeEach(() => {
    __reset();
    clearPlaybackCache();
    __setUserId('guest-1', { anonymous: true });
  });

  it('maps preview_seconds onto the grant, with the short-lived token', async () => {
    const result = await fetchPlayback('ep-free');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.grant.previewSeconds).toBe(15);
    const lifetimeSec = (result.grant.expiresAt - Date.now()) / 1000;
    expect(lifetimeSec).toBeGreaterThan(25);
    expect(lifetimeSec).toBeLessThanOrEqual(30);
  });

  it('follows the server-configured preview length', async () => {
    __setConfig('guest_preview_seconds', 8);
    const result = await fetchPlayback('ep-free');
    expect(result.ok && result.grant.previewSeconds).toBe(8);
  });

  it('never caches a preview grant (each request asks the server)', async () => {
    const invoke = jest.spyOn(supabase.functions, 'invoke');
    await fetchPlayback('ep-free');
    await fetchPlayback('ep-free');
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('a held preview grant stays usable until just before it expires', async () => {
    const result = await fetchPlayback('ep-free');
    if (!result.ok) throw new Error('expected a grant');
    // The 60 s margin for member tokens would call a 30 s token stale at once.
    expect(isGrantFresh(result.grant)).toBe(true);
    expect(isGrantFresh({ ...result.grant, expiresAt: Date.now() + 2_000 })).toBe(false);
  });

  it.each(['ep-coin', 'ep-ad', 'ep-member'])('answers account_required for the paid episode %s', async (episodeId) => {
    expect(await fetchPlayback(episodeId)).toEqual({ ok: false, code: 'account_required' });
  });
});

describe('playback-token for members', () => {
  beforeEach(() => {
    __reset();
    clearPlaybackCache();
    __setUserId('test-user-1', { anonymous: false });
  });

  it('full grants carry no preview limit and are cached', async () => {
    const invoke = jest.spyOn(supabase.functions, 'invoke');
    const first = await fetchPlayback('ep-free');
    await fetchPlayback('ep-free');
    expect(first.ok && first.grant.previewSeconds).toBeUndefined();
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
