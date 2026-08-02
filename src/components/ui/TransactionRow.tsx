import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';
import type { Transaction } from '@/types';
import { formatRelativeDate } from '@/utils/format';

const ICONS: Record<Transaction['type'], keyof typeof Ionicons.glyphMap> = {
  purchase: 'card',
  unlock: 'lock-open',
  bonus: 'gift',
  reward: 'trophy',
  reset: 'refresh',
};

export function TransactionRow({ transaction }: { transaction: Transaction }) {
  const isPositive = transaction.amount >= 0;
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Ionicons name={ICONS[transaction.type]} size={16} color={colors.textSecondary} />
      </View>
      <View style={styles.middle}>
        <Text style={styles.label} numberOfLines={1}>
          {transaction.label}
        </Text>
        <Text style={styles.date}>{formatRelativeDate(transaction.timestamp)}</Text>
      </View>
      <Text style={[styles.amount, isPositive ? styles.positive : styles.negative]}>
        {isPositive ? '+' : ''}
        {transaction.amount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1 },
  label: { ...typography.bodyMedium, color: colors.textPrimary },
  date: { ...typography.caption, color: colors.textTertiary, marginTop: 1 },
  amount: { ...typography.bodyMedium },
  positive: { color: colors.success },
  negative: { color: colors.textSecondary },
});
