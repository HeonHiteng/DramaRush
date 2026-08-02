import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';
import type { EpisodeAccessType } from '@/types';
import { BRAND } from '@/config';

interface LockBadgeProps {
  access: EpisodeAccessType;
  coinPrice?: number;
}

export function LockBadge({ access, coinPrice }: LockBadgeProps) {
  if (access === 'free') {
    return (
      <View style={[styles.badge, styles.freeBadge]}>
        <Text style={[styles.text, styles.freeText]}>FREE</Text>
      </View>
    );
  }
  if (access === 'subscriber') {
    return (
      <View style={[styles.badge, styles.subBadge]} accessibilityLabel="Subscriber only">
        <Ionicons name="star" size={11} color={colors.gold} />
        <Text style={[styles.text, styles.subText]}>MEMBERS</Text>
      </View>
    );
  }
  if (access === 'ad_unlock') {
    return (
      <View style={[styles.badge, styles.adBadge]} accessibilityLabel="Unlock by watching an ad">
        <Ionicons name="play-circle-outline" size={12} color={colors.info} />
        <Text style={[styles.text, styles.adText]}>AD UNLOCK</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, styles.coinBadge]} accessibilityLabel={`Unlock for ${coinPrice ?? ''} coins`}>
      <Ionicons name="lock-closed" size={11} color={colors.gold} />
      <Text style={[styles.text, styles.coinText]}>
        {BRAND.currency.coinSymbol} {coinPrice ?? '--'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  text: { ...typography.micro },
  freeBadge: { backgroundColor: 'rgba(61,220,132,0.16)' },
  freeText: { color: colors.success },
  subBadge: { backgroundColor: colors.goldMuted },
  subText: { color: colors.gold },
  adBadge: { backgroundColor: 'rgba(78,140,255,0.16)' },
  adText: { color: colors.info },
  coinBadge: { backgroundColor: colors.goldMuted },
  coinText: { color: colors.gold },
});
