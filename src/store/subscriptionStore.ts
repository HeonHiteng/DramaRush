import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SubscriptionPlanId } from '@/types';
import { asyncStorageAdapter, STORAGE_KEYS } from './storage';

interface SubscriptionStoreState {
  isActive: boolean;
  planId: SubscriptionPlanId | null;
  startedAt: string | null;
  renewsAt: string | null;
  activate: (planId: SubscriptionPlanId) => void;
  cancel: () => void;
  reset: () => void;
}

function renewalFor(planId: SubscriptionPlanId, from: Date): string {
  const date = new Date(from);
  if (planId === 'monthly') date.setMonth(date.getMonth() + 1);
  else date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
}

export const useSubscriptionStore = create<SubscriptionStoreState>()(
  persist(
    (set) => ({
      isActive: false,
      planId: null,
      startedAt: null,
      renewsAt: null,
      activate: (planId) => {
        const now = new Date();
        set({
          isActive: true,
          planId,
          startedAt: now.toISOString(),
          renewsAt: renewalFor(planId, now),
        });
      },
      cancel: () => set({ isActive: false, planId: null, startedAt: null, renewsAt: null }),
      reset: () => set({ isActive: false, planId: null, startedAt: null, renewsAt: null }),
    }),
    {
      name: STORAGE_KEYS.subscription,
      storage: asyncStorageAdapter,
    }
  )
);
