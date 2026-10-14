export type AuthProvider = 'guest' | 'email' | 'phone' | 'google' | 'apple';

export interface MockUser {
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

export type SubscriptionPlanId = 'monthly' | 'annual';

export interface SubscriptionState {
  isActive: boolean;
  planId: SubscriptionPlanId | null;
  startedAt: string | null;
  renewsAt: string | null;
}
