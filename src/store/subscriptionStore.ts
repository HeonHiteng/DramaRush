import { create } from 'zustand';
import type { SubscriptionPlanId } from '@/types';
import { supabase } from '@/lib/supabase';

interface SubscriptionStoreState {
  isActive: boolean;
  planId: SubscriptionPlanId | null;
  startedAt: string | null;
  renewsAt: string | null;
  isHydrated: boolean;
  /** Still-simulated activation trigger (no real IAP yet), real persisted row. */
  activate: (planId: SubscriptionPlanId) => Promise<void>;
  cancel: () => Promise<void>;
  hydrateFromServer: () => Promise<void>;
  resetLocal: () => void;
}

const EMPTY_STATE = { isActive: false, planId: null, startedAt: null, renewsAt: null } as const;

async function currentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function renewalFor(planId: SubscriptionPlanId, from: Date): string {
  const date = new Date(from);
  if (planId === 'monthly') date.setMonth(date.getMonth() + 1);
  else date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
}

export const useSubscriptionStore = create<SubscriptionStoreState>()((set) => ({
  ...EMPTY_STATE,
  isHydrated: false,

  activate: async (planId) => {
    const userId = await currentUserId();
    if (!userId) return;
    const now = new Date();
    const startedAt = now.toISOString();
    const renewsAt = renewalFor(planId, now);
    const { error } = await supabase
      .from('subscriptions')
      .update({ is_active: true, plan_id: planId, started_at: startedAt, renews_at: renewsAt })
      .eq('user_id', userId);
    if (error) {
      console.warn('activate subscription failed', error);
      return;
    }
    set({ isActive: true, planId, startedAt, renewsAt });
  },

  cancel: async () => {
    const userId = await currentUserId();
    set({ ...EMPTY_STATE });
    if (userId) {
      await supabase
        .from('subscriptions')
        .update({ is_active: false, plan_id: null, started_at: null, renews_at: null })
        .eq('user_id', userId);
    }
  },

  hydrateFromServer: async () => {
    const userId = await currentUserId();
    if (!userId) {
      set({ ...EMPTY_STATE, isHydrated: true });
      return;
    }
    const { data } = await supabase
      .from('subscriptions')
      .select('is_active, plan_id, started_at, renews_at')
      .eq('user_id', userId)
      .maybeSingle();
    set({
      isActive: data?.is_active ?? false,
      planId: (data?.plan_id as SubscriptionPlanId | null) ?? null,
      startedAt: data?.started_at ?? null,
      renewsAt: data?.renews_at ?? null,
      isHydrated: true,
    });
  },

  resetLocal: () => set({ ...EMPTY_STATE, isHydrated: false }),
}));
