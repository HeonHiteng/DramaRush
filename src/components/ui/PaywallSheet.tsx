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
import { useTranslation } from '@/i18n/useTranslation';

interface PaywallSheetProps {
  visible: boolean;
  onClose: () => void;
  episode: Episode;
  seriesTitle: string;
  seriesRating: number;
  totalEpisodes: number;
  coinBalance: number;
  isSubscriber: boolean;
  /**
   * A guest on an ad episode: the ad is the only unlock they may use, so the
   * balance, coin packages, membership and restore rows are left out.
   */
  adOnly?: boolean;
  onUnlockWithCoins: () => Promise<boolean>;
  onWatchAd: () => void;
  onViewCoinPackages: () => void;
  onViewMembership: () => void;
  onRestorePurchases: () => void;
  onUnlocked: () => void;
}

type Status = 'idle' | 'processing' | 'success' | 'insufficient';

// How long the success checkmark stays on screen before the sheet closes
// itself and hands control back to the player.
const UNLOCK_SUCCESS_DELAY_MS = 900;

export function PaywallSheet({
  visible,
  onClose,
  episode,
  seriesTitle,
  seriesRating,
  totalEpisodes,
  coinBalance,
  isSubscriber,
  adOnly = false,
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
  const { t } = useTranslation();

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
      setTimeout(onUnlocked, UNLOCK_SUCCESS_DELAY_MS);
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
          <Text style={styles.headerTitle}>{t('paywall.membersOnlyTitle')}</Text>
        </View>
        <PaywallEpisodeSummary
          seriesTitle={seriesTitle}
          episode={episode}
          seriesRating={seriesRating}
          totalEpisodes={totalEpisodes}
        />
        <Text style={styles.body}>{t('paywall.membersOnlyBody', { brand: BRAND.name })}</Text>
        <AppButton label={t('paywall.viewMembership')} onPress={onViewMembership} variant="gold" fullWidth style={styles.primaryAction} />
        <AppButton label={t('wallet.restorePurchases')} onPress={onRestorePurchases} variant="ghost" fullWidth style={styles.secondaryAction} />
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
          <Text style={styles.successTitle}>{t('paywall.unlockedTitle')}</Text>
          <Text style={styles.body}>{t('paywall.enjoyEpisode', { number: episode.number })}</Text>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Ionicons name="lock-closed" size={20} color={colors.gold} />
            <Text style={styles.headerTitle}>{t('paywall.unlockTitle')}</Text>
          </View>
          <PaywallEpisodeSummary
            seriesTitle={seriesTitle}
            episode={episode}
            seriesRating={seriesRating}
            totalEpisodes={totalEpisodes}
          />

          {!adOnly && (
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>{t('wallet.yourBalance')}</Text>
              <CoinBadge amount={coinBalance} />
            </View>
          )}

          {status === 'insufficient' && (
            <View style={styles.warningBox}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.warningText}>
                {t('paywall.insufficientBalance', { unit: BRAND.currency.coinNamePlural.toLowerCase() })}
              </Text>
            </View>
          )}

          {episode.access === 'coin' && !adOnly && (
            <AppButton
              label={t('paywall.unlockForPrice', { price: episode.coinPrice ?? 0, symbol: BRAND.currency.coinSymbol })}
              onPress={handleUnlock}
              loading={status === 'processing'}
              variant="primary"
              fullWidth
              style={styles.primaryAction}
            />
          )}

          {episode.access === 'ad_unlock' && (
            <AppButton
              label={t('paywall.watchAdFree')}
              onPress={onWatchAd}
              variant="primary"
              fullWidth
              icon={<Ionicons name="play-circle-outline" size={18} color={colors.textInverse} />}
              style={styles.primaryAction}
            />
          )}

          {!adOnly && (
            <>
              <View style={styles.linkRow}>
                <AppButton label={t('paywall.viewCoinPackages')} onPress={onViewCoinPackages} variant="ghost" style={styles.linkButton} />
                <AppButton label={t('paywall.viewMembership')} onPress={onViewMembership} variant="ghost" style={styles.linkButton} />
              </View>
              <AppButton label={t('wallet.restorePurchases')} onPress={onRestorePurchases} variant="ghost" fullWidth />
              {isSubscriber && <Text style={styles.memberHint}>{t('paywall.memberHint')}</Text>}
            </>
          )}
        </>
      )}
    </BottomSheet>
  );
}

interface PaywallEpisodeSummaryProps {
  seriesTitle: string;
  episode: Episode;
  seriesRating: number;
  totalEpisodes: number;
}

/** The series/episode identification block shown identically at the top of
 * both paywall variants (members-only and coin/ad) — pulled out once rather
 * than repeated so the two variants can't drift apart by accident. */
function PaywallEpisodeSummary({ seriesTitle, episode, seriesRating, totalEpisodes }: PaywallEpisodeSummaryProps) {
  const { t } = useTranslation();
  return (
    <>
      <Text style={styles.episodeTitle}>{seriesTitle}</Text>
      <Text style={styles.episodeSubtitle}>{t('paywall.episodeMeta', { number: episode.number, title: episode.title })}</Text>
      <PaywallHook seriesRating={seriesRating} episode={episode} totalEpisodes={totalEpisodes} />
    </>
  );
}

/** A small, honest hook at the exact moment someone's asked to pay: the
 * series' real rating plus how much of the story is still ahead — no
 * fabricated urgency, just data the app already has. */
function PaywallHook({ seriesRating, episode, totalEpisodes }: { seriesRating: number; episode: Episode; totalEpisodes: number }) {
  const { t } = useTranslation();
  const remaining = totalEpisodes - episode.number;

  return (
    <View style={styles.hookRow}>
      <View style={styles.ratingChip}>
        <Ionicons name="star" size={11} color={colors.gold} />
        <Text style={styles.ratingChipText}>{seriesRating.toFixed(1)}</Text>
      </View>
      {remaining > 0 && <Text style={styles.hookText}>{t('paywall.episodesAhead', { count: remaining })}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  episodeTitle: { ...typography.bodyMedium, color: colors.textSecondary },
  episodeSubtitle: { ...typography.caption, color: colors.textTertiary, marginBottom: spacing.xs },
  hookRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.goldMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  ratingChipText: { ...typography.micro, color: colors.gold },
  hookText: { ...typography.caption, color: colors.textTertiary },
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
