export type AuthProvider = 'guest' | 'email' | 'google' | 'apple';

export interface MockUser {
  id: string;
  displayName: string;
  email?: string;
  avatarSeed: string;
  provider: AuthProvider;
  createdAt: string;
}

export type SubscriptionPlanId = 'monthly' | 'annual';

export interface SubscriptionState {
  isActive: boolean;
  planId: SubscriptionPlanId | null;
  startedAt: string | null;
  renewsAt: string | null;
}
