import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { colors, radius, spacing, typography } from '@/theme';
import { BottomSheet } from './BottomSheet';
import { AppButton } from './AppButton';
import { CoinBadge } from './CoinBadge';
import type { Episode } from '@/types';
import { BRAND } from '@/config';
import { useHaptics } from '@/hooks/useHaptics';

interface PaywallSheetProps {
  visible: boolean;
  onClose: () => void;
  episode: Episode;
  seriesTitle: string;
  coinBalance: number;
  isSubscriber: boolean;
  onUnlockWithCoins: () => Promise<boolean>;
  onWatchAd: () => void;
  onViewCoinPackages: () => void;
  onViewMembership: () => void;
  onRestorePurchases: () => void;
  onUnlocked: () => void;
}

type Status = 'idle' | 'processing' | 'success' | 'insufficient';

export function PaywallSheet({
  visible,
  onClose,
  episode,
  seriesTitle,
  coinBalance,
  isSubscriber,
  onUnlockWithCoins,
  onWatchAd,
  onViewCoinPackages,
  onViewMembership,
  onRestorePurchases,
  onUnlocked,
}: PaywallSheetProps) {
  const [status, setStatus] = useState<Status>('idle');
  const { success: successHaptic, impact } = useHaptics();
  const checkScale = useSharedValue(0);

  useEffect(() => {
    if (visible) setStatus('idle');
  }, [visible]);

  const handleUnlock = async () => {
    impact();
    setStatus('processing');
    const ok = await onUnlockWithCoins();
    if (ok) {
      setStatus('success');
      successHaptic();
      checkScale.value = withSequence(withTiming(1.15, { duration: 220 }), withTiming(1, { duration: 120 }));
      setTimeout(() => {
        onUnlocked();
      }, 900);
    } else {
      setStatus('insufficient');
    }
  };

  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));

  if (episode.access === 'subscriber') {
    return (
      <BottomSheet visible={visible} onClose={onClose}>
        <View style={styles.header}>
          <Ionicons name="star" size={22} color={colors.gold} />
          <Text style={styles.headerTitle}>Members-only episode</Text>
        </View>
        <Text style={styles.episodeTitle}>{seriesTitle}</Text>
        <Text style={styles.episodeSubtitle}>
          Episode {episode.number} · {episode.title}
        </Text>
        <Text style={styles.body}>
          This episode is exclusive to DramaRush members. Join to unlock it instantly along with every other
          subscriber-only title.
        </Text>
        <AppButton label="View Membership" onPress={onViewMembership} variant="gold" fullWidth style={styles.primaryAction} />
        <AppButton label="Restore Purchases" onPress={onRestorePurchases} variant="ghost" fullWidth style={styles.secondaryAction} />
      </BottomSheet>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {status === 'success' ? (
        <View style={styles.successWrap}>
          <Animated.View style={[styles.successCircle, checkStyle]}>
            <Ionicons name="checkmark" size={36} color={colors.textInverse} />
          </Animated.View>
          <Text style={styles.successTitle}>Episode unlocked!</Text>
          <Text style={styles.body}>Enjoy episode {episode.number}.</Text>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Ionicons name="lock-closed" size={20} color={colors.gold} />
            <Text style={styles.headerTitle}>Unlock this episode</Text>
          </View>
          <Text style={styles.episodeTitle}>{seriesTitle}</Text>
          <Text style={styles.episodeSubtitle}>
            Episode {episode.number} · {episode.title}
          </Text>

          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Your balance</Text>
            <CoinBadge amount={coinBalance} />
          </View>

          {status === 'insufficient' && (
            <View style={styles.warningBox}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.warningText}>
                Not enough {BRAND.currency.coinNamePlural.toLowerCase()}. Top up your wallet or watch an ad instead.
              </Text>
            </View>
          )}

          {episode.access === 'coin' && (
            <AppButton
              label={`Unlock for ${episode.coinPrice ?? 0} ${BRAND.currency.coinSymbol}`}
              onPress={handleUnlock}
              loading={status === 'processing'}
              variant="primary"
              fullWidth
              style={styles.primaryAction}
            />
          )}

          {episode.access === 'ad_unlock' && (
            <AppButton
              label="Watch Advertisement (Free)"
              onPress={onWatchAd}
              variant="primary"
              fullWidth
              icon={<Ionicons name="play-circle-outline" size={18} color={colors.textInverse} />}
              style={styles.primaryAction}
            />
          )}

          <View style={styles.linkRow}>
            <AppButton label="View Coin Packages" onPress={onViewCoinPackages} variant="ghost" style={styles.linkButton} />
            <AppButton label="View Membership" onPress={onViewMembership} variant="ghost" style={styles.linkButton} />
          </View>
          <AppButton label="Restore Purchases" onPress={onRestorePurchases} variant="ghost" fullWidth />
          {isSubscriber && (
            <Text style={styles.memberHint}>
              You&apos;re a member — some episodes are already included with your plan.
            </Text>
          )}
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  episodeTitle: { ...typography.bodyMedium, color: colors.textSecondary },
  episodeSubtitle: { ...typography.caption, color: colors.textTertiary, marginBottom: spacing.md },
  body: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  balanceLabel: { ...typography.body, color: colors.textSecondary },
  warningBox: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: 'rgba(232,71,76,0.12)',
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    alignItems: 'flex-start',
  },
  warningText: { ...typography.caption, color: colors.danger, flex: 1 },
  primaryAction: { marginBottom: spacing.sm },
  secondaryAction: { marginBottom: spacing.sm },
  linkRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  linkButton: { flex: 1 },
  memberHint: { ...typography.caption, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.xs },
  successWrap: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs },
  successCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  successTitle: { ...typography.h2, color: colors.textPrimary },
});
