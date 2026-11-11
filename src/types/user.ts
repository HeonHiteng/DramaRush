export type AuthProvider = 'guest' | 'email' | 'phone' | 'google' | 'apple';

export interface AppUser {
  id: string;
  displayName: string;
  email?: string;
  /** International number without "+", for WhatsApp (phone) sign-ins. */
  phone?: string;
  /** 7-character member code (also the video watermark) — what support asks for. */
  publicCode?: string;
  avatarSeed: string;
  provider: AuthProvider;
  createdAt: string;
  isAdmin: boolean;
}

/** subscription_plans.id ('monthly' / 'annual' today; the catalog lives in the database). */
export type SubscriptionPlanId = string;

export interface SubscriptionState {
  isActive: boolean;
  planId: SubscriptionPlanId | null;
  startedAt: string | null;
  renewsAt: string | null;
  /** Set by cancel_subscription(): access continues until renewsAt. */
  cancelledAt: string | null;
}
