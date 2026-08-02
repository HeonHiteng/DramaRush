import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';

export function PremiumBadge({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.badge, compact && styles.compact]} accessibilityLabel="Premium member">
      <Ionicons name="diamond" size={compact ? 10 : 12} color={colors.textInverse} />
      {!compact && <Text style={styles.text}>PREMIUM</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  compact: { paddingHorizontal: 5, paddingVertical: 4, borderRadius: radius.pill },
  text: { ...typography.micro, color: colors.textInverse },
});
