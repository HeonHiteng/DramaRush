import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { StackHeader } from '@/components/ui/StackHeader';
import { AppButton } from '@/components/ui/AppButton';
import { SubscriptionCard } from '@/components/ui/SubscriptionCard';
import { SUBSCRIPTION_PLANS } from '@/data';
import { useSubscriptionStore, useWalletStore } from '@/store';
import { BRAND } from '@/config';
import { formatDateLong } from '@/utils/format';
import { useHaptics } from '@/hooks/useHaptics';
import type { SubscriptionPlanId } from '@/types';

const BENEFITS = [
  { icon: 'diamond' as const, label: 'Access to every premium episode' },
  { icon: 'ban' as const, label: 'Fewer advertisements while browsing' },
  { icon: 'sparkles' as const, label: 'Monthly bonus coins added automatically' },
  { icon: 'flash' as const, label: 'Early access to selected new series' },
  { icon: 'ribbon' as const, label: 'A premium badge on your profile' },
];

export default function SubscriptionScreen() {
  const subscription = useSubscriptionStore();
  const addCoins = useWalletStore((s) => s.addCoins);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>(subscription.planId ?? 'annual');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const { success: successHaptic } = useHaptics();

  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === selectedPlan)!;

  const startMembership = () => {
    setProcessing(true);
    setTimeout(() => {
      subscription.activate(selectedPlan);
      addCoins(plan.bonusCoins, `${plan.title} bonus coins`, 'bonus');
      setProcessing(false);
      setSuccess(true);
      successHaptic();
    }, 1200);
  };

  const cancelMembership = () => {
    const doCancel = () => subscription.cancel();
    if (Platform.OS === 'web') {
      doCancel();
      return;
    }
    Alert.alert('Cancel Membership', 'Your premium access will end immediately in this prototype.', [
      { text: 'Keep Membership', style: 'cancel' },
      { text: 'Cancel Membership', style: 'destructive', onPress: doCancel },
    ]);
  };

  const handleRestore = () => {
    const message = 'No previous subscription found for this device (simulated).';
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      alert(message);
    } else {
      Alert.alert('Restore Purchases', message);
    }
  };

  if (success || subscription.isActive) {
    return (
      <Screen>
        <StackHeader title="Membership" />
        <View style={styles.successRoot}>
          <View style={styles.successCircle}>
            <Ionicons name="diamond" size={36} color={colors.textInverse} />
          </View>
          <Text style={styles.successTitle}>You're a {BRAND.name} member!</Text>
          <Text style={styles.successBody}>
            {subscription.planId === 'annual' ? 'Annual' : 'Monthly'} membership is active
            {subscription.renewsAt ? ` and renews on ${formatDateLong(subscription.renewsAt)}.` : '.'}
          </Text>
          <AppButton label="Back to Browsing" onPress={() => router.back()} fullWidth style={styles.successAction} />
          <AppButton label="Cancel Membership" onPress={cancelMembership} variant="ghost" fullWidth />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <StackHeader title="Membership" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Unlock the full {BRAND.name} experience</Text>

        <View style={styles.plansRow}>
          {SUBSCRIPTION_PLANS.map((p) => (
            <SubscriptionCard key={p.id} plan={p} selected={selectedPlan === p.id} onPress={() => setSelectedPlan(p.id)} />
          ))}
        </View>

        <View style={styles.benefitsCard}>
          {BENEFITS.map((b) => (
            <View key={b.label} style={styles.benefitRow}>
              <View style={styles.benefitIconWrap}>
                <Ionicons name={b.icon} size={16} color={colors.gold} />
              </View>
              <Text style={styles.benefitText}>{b.label}</Text>
            </View>
          ))}
        </View>

        <AppButton
          label={`Start Membership · ${plan.priceLabel}`}
          onPress={startMembership}
          loading={processing}
          fullWidth
          size="lg"
          style={styles.startAction}
        />
        <AppButton label="Restore Purchases" onPress={handleRestore} variant="ghost" fullWidth />

        <Text style={styles.disclosure}>
          This is a prototype: no payment is collected. In a production app, membership would auto-renew at{' '}
          {plan.priceLabel} {plan.periodLabel} until cancelled, in line with app store subscription policies.
        </Text>
      </ScrollView>
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
});
