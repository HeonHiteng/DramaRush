import { create } from 'zustand';
import type { SubscriptionPlanId } from '@/types';
import { supabase } from '@/lib/supabase';
import { useUserStore } from './userStore';
import { useWalletStore } from './walletStore';

interface SubscriptionStoreState {
  /** Membership grants access right now (a cancelled one does until renewsAt). */
  isActive: boolean;
  planId: SubscriptionPlanId | null;
  startedAt: string | null;
  renewsAt: string | null;
  /** When the member cancelled; access continues until renewsAt. */
  cancelledAt: string | null;
  isHydrated: boolean;
  /** Message of the last failed hydrate (the previous data is kept), or null. */
  hydrateError: string | null;
  /** Epoch ms of the last successful hydrate, for refreshIfStale(). */
  lastHydratedAt: number | null;
  /**
   * Still-simulated activation (no real IAP yet). The simulate_subscribe()
   * RPC sets the membership and grants the plan's bonus coins server-side
   * (at most once per billing period). Returns false if the server refused.
   */
  activate: (planId: SubscriptionPlanId) => Promise<boolean>;
  /** cancel_subscription(): marks the membership cancelled. Returns false if the server refused. */
  cancel: () => Promise<boolean>;
  hydrateFromServer: () => Promise<void>;
  /** hydrateFromServer() unless the last successful one is younger than `maxAgeMs`. */
  refreshIfStale: (maxAgeMs: number) => Promise<void>;
  resetLocal: () => void;
}

interface SubscriptionRow {
  is_active: boolean;
  plan_id: string | null;
  started_at: string | null;
  renews_at: string | null;
  cancelled_at?: string | null;
}

const EMPTY_MEMBERSHIP = { isActive: false, planId: null, startedAt: null, renewsAt: null, cancelledAt: null } as const;
const EMPTY_STATE = { ...EMPTY_MEMBERSHIP, hydrateError: null, lastHydratedAt: null } as const;

/** The signed-in user as AuthListener last saw it — no auth network call. */
function currentUserId(): string | null {
  return useUserStore.getState().user?.id ?? null;
}

/** A membership past its renewal date no longer counts (the server checks the same). */
function fromRow(row: SubscriptionRow | null) {
  const expired = !!row?.renews_at && Date.parse(row.renews_at) <= Date.now();
  return {
    isActive: (row?.is_active ?? false) && !expired,
    planId: row?.plan_id ?? null,
    startedAt: row?.started_at ?? null,
    renewsAt: row?.renews_at ?? null,
    cancelledAt: row?.cancelled_at ?? null,
  };
}

export const useSubscriptionStore = create<SubscriptionStoreState>()((set, get) => ({
  ...EMPTY_STATE,
  isHydrated: false,

  activate: async (planId) => {
    const userId = currentUserId();
    const { data, error } = await supabase.rpc('simulate_subscribe', { p_plan_id: planId });
    if (error) {
      console.warn('activate subscription failed', error);
      return false;
    }
    if (currentUserId() !== userId) return true;
    set(fromRow(data as SubscriptionRow));
    await useWalletStore.getState().hydrateFromServer();
    return true;
  },

  cancel: async () => {
    const userId = currentUserId();
    const { data, error } = await supabase.rpc('cancel_subscription');
    if (error) {
      console.warn('cancel subscription failed', error);
      return false;
    }
    // The row comes back still active, with cancelled_at set.
    if (currentUserId() === userId) set(fromRow(data as SubscriptionRow | null));
    return true;
  },

  hydrateFromServer: async () => {
    const userId = currentUserId();
    if (!userId) {
      set({ ...EMPTY_STATE, isHydrated: true });
      return;
    }
    const read = (columns: string) => supabase.from('subscriptions').select(columns).eq('user_id', userId).maybeSingle<SubscriptionRow>();
    let { data, error } = await read('is_active, plan_id, started_at, renews_at, cancelled_at');
    // 42703 = undefined column: a database without 20261019120000_account_rules
    // (cancelled_at) yet. Read the old columns rather than lose the membership.
    if (error?.code === '42703') ({ data, error } = await read('is_active, plan_id, started_at, renews_at'));
    if (currentUserId() !== userId) return;
    if (error) {
      console.warn('subscription hydrate failed', error);
      set({ hydrateError: String(error.message ?? error), isHydrated: true });
      return;
    }
    set({ ...fromRow(data), hydrateError: null, lastHydratedAt: Date.now(), isHydrated: true });
  },

  refreshIfStale: async (maxAgeMs) => {
    const last = get().lastHydratedAt;
    if (last !== null && Date.now() - last < maxAgeMs) return;
    await get().hydrateFromServer();
  },

  resetLocal: () => set({ ...EMPTY_STATE, isHydrated: false }),
}));
