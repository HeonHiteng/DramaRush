import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { BRAND } from '@/config';

interface CoinBadgeProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
}

export function CoinBadge({ amount, size = 'md' }: CoinBadgeProps) {
  return (
    <View
      style={[styles.badge, size === 'lg' && styles.lg, size === 'sm' && styles.sm]}
      accessibilityLabel={`${amount} ${BRAND.currency.coinNamePlural}`}
    >
      <Text style={[styles.symbol, size === 'lg' && styles.symbolLg]}>{BRAND.currency.coinSymbol}</Text>
      <Text style={[styles.text, size === 'lg' && styles.textLg]}>{amount.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.goldMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  sm: { paddingHorizontal: spacing.xs, paddingVertical: 2 },
  lg: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  symbol: { fontSize: 13 },
  symbolLg: { fontSize: 20 },
  text: { ...typography.bodyMedium, color: colors.gold },
  textLg: { ...typography.h3, color: colors.gold },
});
