import { create } from 'zustand';
import type { SubscriptionPlanId } from '@/types';
import { supabase } from '@/lib/supabase';
import { useWalletStore } from './walletStore';

interface SubscriptionStoreState {
  isActive: boolean;
  planId: SubscriptionPlanId | null;
  startedAt: string | null;
  renewsAt: string | null;
  isHydrated: boolean;
  /**
   * Still-simulated activation (no real IAP yet). The simulate_subscribe()
   * RPC sets the membership and grants the plan's bonus coins server-side.
   * Returns false if the server refused.
   */
  activate: (planId: SubscriptionPlanId) => Promise<boolean>;
  cancel: () => Promise<void>;
  hydrateFromServer: () => Promise<void>;
  resetLocal: () => void;
}

interface SubscriptionRow {
  is_active: boolean;
  plan_id: string | null;
  started_at: string | null;
  renews_at: string | null;
}

const EMPTY_STATE = { isActive: false, planId: null, startedAt: null, renewsAt: null } as const;

async function currentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** A membership past its renewal date no longer counts (the server checks the same). */
function fromRow(row: SubscriptionRow | null) {
  const expired = !!row?.renews_at && Date.parse(row.renews_at) <= Date.now();
  return {
    isActive: (row?.is_active ?? false) && !expired,
    planId: (row?.plan_id as SubscriptionPlanId | null) ?? null,
    startedAt: row?.started_at ?? null,
    renewsAt: row?.renews_at ?? null,
  };
}

export const useSubscriptionStore = create<SubscriptionStoreState>()((set) => ({
  ...EMPTY_STATE,
  isHydrated: false,

  activate: async (planId) => {
    const { data, error } = await supabase.rpc('simulate_subscribe', { p_plan_id: planId });
    if (error) {
      console.warn('activate subscription failed', error);
      return false;
    }
    set(fromRow(data as SubscriptionRow));
    await useWalletStore.getState().hydrateFromServer();
    return true;
  },

  cancel: async () => {
    const { error } = await supabase.rpc('cancel_subscription');
    if (error) {
      console.warn('cancel subscription failed', error);
      return;
    }
    set({ ...EMPTY_STATE });
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
    set({ ...fromRow(data), isHydrated: true });
  },

  resetLocal: () => set({ ...EMPTY_STATE, isHydrated: false }),
}));
