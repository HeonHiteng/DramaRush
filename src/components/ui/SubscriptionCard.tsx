import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';
import type { SubscriptionPlan } from '@/types';
import { BRAND } from '@/config';

interface SubscriptionCardProps {
  plan: SubscriptionPlan;
  selected: boolean;
  onPress: () => void;
}

export function SubscriptionCard({ plan, selected, onPress }: SubscriptionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${plan.title}, ${plan.priceLabel} ${plan.periodLabel}`}
      style={[styles.card, selected && styles.cardSelected]}
    >
      {plan.bestValue && (
        <View style={styles.bestValueBadge}>
          <Text style={styles.bestValueText}>BEST VALUE</Text>
        </View>
      )}
      <View style={styles.radioRow}>
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected && <View style={styles.radioDot} />}
        </View>
        <Text style={styles.title}>{plan.title}</Text>
      </View>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{plan.priceLabel}</Text>
        <Text style={styles.period}>{plan.periodLabel}</Text>
      </View>
      {plan.monthlyEquivalentLabel && <Text style={styles.equivalent}>{plan.monthlyEquivalentLabel}</Text>}
      <View style={styles.bonusRow}>
        <Ionicons name="sparkles" size={13} color={colors.gold} />
        <Text style={styles.bonusText}>
          +{plan.bonusCoins} bonus {BRAND.currency.coinNamePlural.toLowerCase()}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardSelected: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  bestValueText: { ...typography.micro, color: colors.textInverse },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.accent },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent },
  title: { ...typography.bodyMedium, color: colors.textPrimary, flexShrink: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  price: { ...typography.h2, color: colors.textPrimary },
  period: { ...typography.caption, color: colors.textTertiary },
  equivalent: { ...typography.caption, color: colors.success },
  bonusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xxs },
  bonusText: { ...typography.caption, color: colors.gold },
});
