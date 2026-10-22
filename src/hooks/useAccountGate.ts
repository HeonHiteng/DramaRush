import { create } from 'zustand';
import { useUserStore } from '@/store/userStore';

/**
 * What a guest tried to do: picks the gate's subtitle. 'rpc' is the
 * catch-all for a server 'account_required' answer nothing else predicted.
 */
export type AccountGateReason = 'paywall' | 'coins' | 'membership' | 'mission' | 'ad' | 'rpc';

interface AccountGateState {
  /** Why the "link an account" sheet is open, or null when it's closed. */
  reason: AccountGateReason | null;
  open: (reason: AccountGateReason) => void;
  close: () => void;
}

/**
 * One gate for the whole app (screens each mount an <AccountGateSheet />,
 * which shows only while its screen is focused), so a component deep in a
 * screen — the daily mission card, a player page — can open it.
 */
export const useAccountGateStore = create<AccountGateState>()((set) => ({
  reason: null,
  open: (reason) => set({ reason }),
  close: () => set({ reason: null }),
}));

/** Guests can browse, watch free episodes and unlock ad episodes, but coins, coin unlocks, memberships and the daily mission need a linked account. */
export function isGuestUser(): boolean {
  return useUserStore.getState().user?.provider === 'guest';
}

/**
 * Needs an account before coins, unlocks or memberships: a guest, or nobody
 * at all (no session yet, or one that just ended unexpectedly).
 */
export function needsAccount(): boolean {
  const user = useUserStore.getState().user;
  return !user || user.provider === 'guest';
}

/**
 * Call before anything a guest may not do. Returns true for a member (go
 * ahead); for a guest — or when nobody is signed in — it opens the
 * link-account sheet and returns false.
 */
export function requireAccount(reason: AccountGateReason): boolean {
  if (!needsAccount()) return true;
  openGate(reason);
  return false;
}

/** Opens the gate unconditionally — for a server 'account_required' answer, whatever the client believed. */
export function openGate(reason: AccountGateReason): void {
  useAccountGateStore.getState().open(reason);
}

export function useAccountGate() {
  const isGuest = useUserStore((s) => s.user?.provider === 'guest');
  return { isGuest, requireAccount, openGate };
}
