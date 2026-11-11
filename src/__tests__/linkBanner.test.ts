import { LINK_BANNER_SNOOZE_MS, shouldShowLinkBanner, useSettingsStore } from '@/store/settingsStore';

const NOW = Date.parse('2026-10-20T12:00:00Z');
const HOUR = 60 * 60 * 1000;

describe('shouldShowLinkBanner', () => {
  const state = (linkBannerDismissedAt: number | null, linkBannerClosedThisLaunch = false) => ({
    linkBannerDismissedAt,
    linkBannerClosedThisLaunch,
  });

  it('shows when it has never been closed', () => {
    expect(shouldShowLinkBanner(state(null), NOW)).toBe(true);
  });

  it('stays hidden for 24 h after a close, then comes back', () => {
    expect(shouldShowLinkBanner(state(NOW - HOUR), NOW)).toBe(false);
    expect(shouldShowLinkBanner(state(NOW - LINK_BANNER_SNOOZE_MS + 1), NOW)).toBe(false);
    expect(shouldShowLinkBanner(state(NOW - LINK_BANNER_SNOOZE_MS), NOW)).toBe(true);
    expect(shouldShowLinkBanner(state(NOW - 3 * LINK_BANNER_SNOOZE_MS), NOW)).toBe(true);
  });

  it('does not come back in the same launch once closed, even after 24 h', () => {
    expect(shouldShowLinkBanner(state(NOW - 2 * LINK_BANNER_SNOOZE_MS, true), NOW)).toBe(false);
  });

  it('is not stuck hidden by a close time in the future (clock turned back)', () => {
    expect(shouldShowLinkBanner(state(NOW + HOUR), NOW)).toBe(true);
  });
});

describe('settingsStore link banner actions', () => {
  beforeEach(() => {
    useSettingsStore.setState({ linkBannerDismissedAt: null, linkBannerClosedThisLaunch: false });
  });

  it('closing records the time and hides it for this launch', () => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    useSettingsStore.getState().dismissLinkBanner();
    const s = useSettingsStore.getState();
    expect(s.linkBannerDismissedAt).toBe(NOW);
    expect(s.linkBannerClosedThisLaunch).toBe(true);
    expect(shouldShowLinkBanner(s, NOW + 2 * LINK_BANNER_SNOOZE_MS)).toBe(false);
    jest.restoreAllMocks();
  });

  it('persists the close time, not the per-launch flag', () => {
    useSettingsStore.setState({ linkBannerDismissedAt: NOW, linkBannerClosedThisLaunch: true });
    const persisted = useSettingsStore.persist.getOptions().partialize!(useSettingsStore.getState()) as Record<string, unknown>;
    expect(persisted).toMatchObject({ linkBannerDismissedAt: NOW });
    expect(persisted).not.toHaveProperty('linkBannerClosedThisLaunch');
  });

  it('resetting the settings leaves the banner state alone', () => {
    useSettingsStore.setState({ linkBannerDismissedAt: NOW });
    useSettingsStore.getState().resetSettings();
    expect(useSettingsStore.getState().linkBannerDismissedAt).toBe(NOW);
  });
});
