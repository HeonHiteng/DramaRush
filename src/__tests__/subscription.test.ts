import { useSubscriptionStore } from '@/store/subscriptionStore';

describe('subscription entitlement', () => {
  beforeEach(() => {
    useSubscriptionStore.setState({ isActive: false, planId: null, startedAt: null, renewsAt: null });
  });

  it('activates a monthly plan and sets a renewal roughly one month out', () => {
    useSubscriptionStore.getState().activate('monthly');
    const state = useSubscriptionStore.getState();
    expect(state.isActive).toBe(true);
    expect(state.planId).toBe('monthly');
    expect(state.renewsAt).not.toBeNull();

    const started = new Date(state.startedAt!);
    const renews = new Date(state.renewsAt!);
    const daysApart = (renews.getTime() - started.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysApart).toBeGreaterThan(25);
    expect(daysApart).toBeLessThan(32);
  });

  it('activates an annual plan and sets a renewal roughly one year out', () => {
    useSubscriptionStore.getState().activate('annual');
    const state = useSubscriptionStore.getState();
    const started = new Date(state.startedAt!);
    const renews = new Date(state.renewsAt!);
    const daysApart = (renews.getTime() - started.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysApart).toBeGreaterThan(360);
    expect(daysApart).toBeLessThan(367);
  });

  it('cancel() clears active entitlement', () => {
    useSubscriptionStore.getState().activate('monthly');
    useSubscriptionStore.getState().cancel();
    const state = useSubscriptionStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.planId).toBeNull();
    expect(state.renewsAt).toBeNull();
  });
});
