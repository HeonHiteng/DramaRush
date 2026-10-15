import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, spacing, typography } from '@/theme';
import type { SubscriptionPlan } from '@/types';
import { BRAND } from '@/config';

interface SubscriptionCardProps {
  plan: SubscriptionPlan;
  selected: boolean;
  onPress: () => void;
}

const UNSELECTED_HEADER = ['#3A2E44', '#241C2C'] as const;

/** Netflix's "Choose your plan" card: a coloured header block naming the
 * plan (lit up and ticked when selected), with the price details below. */
export function SubscriptionCard({ plan, selected, onPress }: SubscriptionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${plan.title}, ${plan.priceLabel} ${plan.periodLabel}`}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <LinearGradient
        colors={selected ? gradients.coralGlow : UNSELECTED_HEADER}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.title} numberOfLines={2}>
          {plan.title}
        </Text>
        {plan.bestValue && (
          <View style={styles.bestValueBadge}>
            <Text style={styles.bestValueText}>BEST VALUE</Text>
          </View>
        )}
        {selected && (
          <View style={styles.check}>
            <Ionicons name="checkmark" size={14} color={colors.accent} />
          </View>
        )}
      </LinearGradient>
      <View style={styles.body}>
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
    overflow: 'hidden',
  },
  cardSelected: { borderColor: colors.accent },
  header: { padding: spacing.md, paddingRight: spacing.xl, minHeight: 84, gap: spacing.xxs },
  title: { ...typography.bodyMedium, color: colors.white, fontWeight: '700' },
  bestValueBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  bestValueText: { ...typography.micro, color: colors.textInverse },
  check: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: spacing.md, gap: spacing.xxs },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 4 },
  price: { ...typography.h2, color: colors.textPrimary },
  period: { ...typography.caption, color: colors.textTertiary },
  equivalent: { ...typography.caption, color: colors.success },
  bonusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xxs },
  bonusText: { ...typography.caption, color: colors.gold, flexShrink: 1 },
});
