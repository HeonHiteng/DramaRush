import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { StackHeader } from '@/components/ui/StackHeader';
import { AppButton } from '@/components/ui/AppButton';
import { SubscriptionCard } from '@/components/ui/SubscriptionCard';
import { AccountGateSheet } from '@/components/ui/AccountGateSheet';
import { usePublicConfig, useSubscriptionPlans } from '@/services/content';
import { useSubscriptionStore } from '@/store';
import { BRAND } from '@/config';
import { formatDateLong } from '@/utils/format';
import { goBack } from '@/utils/navigation';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccountGate } from '@/hooks/useAccountGate';
import { useRefreshOnForeground } from '@/hooks/useRefreshOnForeground';
import { useTranslation } from '@/i18n/useTranslation';
import type { TranslationKey } from '@/i18n/translations';
import type { SubscriptionPlanId } from '@/types';

const BENEFIT_ICONS = ['diamond', 'ban', 'sparkles', 'flash', 'ribbon'] as const;
const BENEFIT_KEYS: TranslationKey[] = [
  'subscription.benefit1',
  'subscription.benefit2',
  'subscription.benefit3',
  'subscription.benefit4',
  'subscription.benefit5',
];

/** How long the "membership started" note stays up after subscribing. */
const SUBSCRIBED_NOTE_MS = 4000;

export default function SubscriptionScreen() {
  const subscription = useSubscriptionStore();
  const { data: plans, isLoading: plansLoading, isError: plansFailed } = useSubscriptionPlans();
  const { data: config } = usePublicConfig();
  // Until the config arrives the server is the judge; hide the buttons only once it says payments are off.
  const paymentsEnabled = config?.simulatedPayments ?? true;
  const { requireAccount } = useAccountGate();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId | null>(subscription.planId);
  const [processing, setProcessing] = useState(false);
  /** Blocks a second tap while a subscribe/cancel call is in flight. */
  const busyRef = useRef(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [justSubscribed, setJustSubscribed] = useState(false);
  const { success: successHaptic } = useHaptics();
  const { t } = useTranslation();

  useRefreshOnForeground(useCallback((maxAgeMs: number) => void useSubscriptionStore.getState().refreshIfStale(maxAgeMs), []));

  useEffect(() => {
    if (!justSubscribed) return;
    const timer = setTimeout(() => setJustSubscribed(false), SUBSCRIBED_NOTE_MS);
    return () => clearTimeout(timer);
  }, [justSubscribed]);

  // Default to the best-value plan once the catalog has loaded.
  const plan =
    plans?.find((p) => p.id === selectedPlan) ?? plans?.find((p) => p.bestValue) ?? plans?.[0] ?? null;
  const currentPlan = plans?.find((p) => p.id === subscription.planId);
  const isAnnual = currentPlan ? currentPlan.period === 'annual' : subscription.planId === 'annual';

  const runAction = async (action: () => Promise<boolean>, onSuccess?: () => void) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setProcessing(true);
    setError(null);
    const ok = await action();
    busyRef.current = false;
    setProcessing(false);
    if (ok) onSuccess?.();
    else setError('subscription.failed');
  };

  const startMembership = (planId: SubscriptionPlanId | undefined) => {
    if (!planId) return;
    // A membership belongs to an account: guests link one first.
    if (!requireAccount('membership')) return;
    // Bonus coins are granted by the server together with the membership.
    runAction(
      () => subscription.activate(planId),
      () => {
        setJustSubscribed(true);
        successHaptic();
      }
    );
  };

  const cancelMembership = () => {
    const doCancel = () => runAction(() => subscription.cancel());
    if (Platform.OS === 'web') {
      doCancel();
      return;
    }
    const body = subscription.renewsAt
      ? t('subscription.cancelConfirmBodyUntil', { date: formatDateLong(subscription.renewsAt) })
      : t('subscription.cancelConfirmBody');
    Alert.alert(t('subscription.cancelConfirmTitle'), body, [
      { text: t('subscription.keepMembership'), style: 'cancel' },
      { text: t('subscription.cancelMembership'), style: 'destructive', onPress: doCancel },
    ]);
  };

  const handleRestore = () => {
    const message = t('subscription.restorePurchasesMessage');
    if (Platform.OS === 'web') {
      alert(message);
    } else {
      Alert.alert(t('subscription.restorePurchases'), message);
    }
  };

  // The member view follows the store alone: a membership that has expired
  // (renewsAt passed) reads as inactive there, and the plans show again.
  if (subscription.isActive) {
    const cancelled = !!subscription.cancelledAt;
    return (
      <Screen>
        <StackHeader title={t('subscription.title')} />
        <View style={styles.successRoot}>
          <View style={styles.successCircle}>
            <Ionicons name="diamond" size={36} color={colors.textInverse} />
          </View>
          <Text style={styles.successTitle}>{t('subscription.memberBadge', { brand: BRAND.name })}</Text>
          {justSubscribed && <Text style={styles.toast}>{t('subscription.subscribedToast')}</Text>}
          <Text style={styles.successBody}>
            {cancelled && subscription.renewsAt ? (
              t('subscription.cancelledUntil', { date: formatDateLong(subscription.renewsAt) })
            ) : (
              <>
                {t('subscription.membershipActive', { plan: isAnnual ? t('profile.annual') : t('profile.monthly') })}
                {subscription.renewsAt ? t('subscription.renewsOn', { date: formatDateLong(subscription.renewsAt) }) : '.'}
              </>
            )}
          </Text>
          {error && <Text style={styles.errorText}>{t(error)}</Text>}
          <AppButton label={t('subscription.backToBrowsing')} onPress={() => goBack()} fullWidth style={styles.successAction} />
          {paymentsEnabled &&
            (cancelled ? (
              <AppButton
                label={t('subscription.resubscribe')}
                onPress={() => startMembership(subscription.planId ?? plan?.id)}
                loading={processing}
                variant="gold"
                fullWidth
              />
            ) : (
              <AppButton
                label={t('subscription.cancelMembership')}
                onPress={cancelMembership}
                loading={processing}
                variant="ghost"
                fullWidth
              />
            ))}
        </View>
        <AccountGateSheet />
      </Screen>
    );
  }

  return (
    <Screen>
      <StackHeader title={t('subscription.title')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{t('subscription.heading', { brand: BRAND.name })}</Text>

        {plansLoading ? (
          <ActivityIndicator color={colors.accent} style={styles.plansLoading} />
        ) : plansFailed || !plans ? (
          <Text style={styles.notice}>{t('subscription.plansUnavailable')}</Text>
        ) : (
          <View style={styles.plansRow}>
            {plans.map((p) => (
              <SubscriptionCard key={p.id} plan={p} selected={plan?.id === p.id} onPress={() => setSelectedPlan(p.id)} />
            ))}
          </View>
        )}

        <View style={styles.benefitsCard}>
          {BENEFIT_KEYS.map((key, i) => (
            <View key={key} style={styles.benefitRow}>
              <View style={styles.benefitIconWrap}>
                <Ionicons name={BENEFIT_ICONS[i]} size={16} color={colors.gold} />
              </View>
              <Text style={styles.benefitText}>{t(key)}</Text>
            </View>
          ))}
        </View>

        {error && <Text style={styles.errorText}>{t(error)}</Text>}
        {!paymentsEnabled ? (
          <Text style={styles.notice}>{t('subscription.comingSoon')}</Text>
        ) : (
          plan && (
            <AppButton
              label={t('subscription.startMembershipPrice', { price: plan.priceLabel })}
              onPress={() => startMembership(plan.id)}
              loading={processing}
              fullWidth
              size="lg"
              style={styles.startAction}
            />
          )
        )}
        <AppButton label={t('subscription.restorePurchases')} onPress={handleRestore} variant="ghost" fullWidth />

        {plan && (
          <Text style={styles.disclosure}>{t('subscription.disclosure', { price: plan.priceLabel, period: plan.periodLabel })}</Text>
        )}
      </ScrollView>
      <AccountGateSheet />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  heading: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.lg },
  plansRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl, marginTop: spacing.sm },
  benefitsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  benefitIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { ...typography.body, color: colors.textSecondary, flex: 1 },
  startAction: { marginBottom: spacing.sm },
  disclosure: { ...typography.caption, color: colors.textDisabled, marginTop: spacing.lg, lineHeight: 17 },
  successRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  successCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successTitle: { ...typography.h1, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.xs },
  successBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
  successAction: { marginBottom: spacing.sm },
  plansLoading: { marginVertical: spacing.xl },
  notice: { ...typography.body, color: colors.textTertiary, textAlign: 'center', marginVertical: spacing.md },
  errorText: { ...typography.caption, color: colors.danger, textAlign: 'center', marginBottom: spacing.sm },
  toast: { ...typography.bodyMedium, color: colors.success, textAlign: 'center', marginBottom: spacing.xs },
});
