import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, typography } from '@/theme';
import { AppButton } from '@/components/ui/AppButton';
import { RewardedAdOverlay } from '@/features/player/RewardedAdOverlay';
import { useWalletStore } from '@/store';
import { BRAND } from '@/config';
import { useTranslation } from '@/i18n/useTranslation';
import type { TranslationKey } from '@/i18n/translations';
import { DEFAULT_PUBLIC_CONFIG, usePublicConfig } from '@/services/content';
import { useAccountGate } from '@/hooks/useAccountGate';

export function DailyMissionCard() {
  const claimedToday = useWalletStore((s) => s.dailyMissionClaimedToday);
  const claimDailyMission = useWalletStore((s) => s.claimDailyMission);
  const [adVisible, setAdVisible] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const { data: config } = usePublicConfig();
  const { requireAccount } = useAccountGate();
  const { t } = useTranslation();
  // The amount is server config (app_config.daily_mission_reward).
  const reward = config?.dailyMissionReward ?? DEFAULT_PUBLIC_CONFIG.dailyMissionReward;

  const startMission = () => {
    // Guests can't earn coins (the RPC answers account_required): ask them
    // to link an account before sitting through the ad.
    if (!requireAccount('mission')) return;
    setAdVisible(true);
  };

  /** Resolves to the message the ad overlay shows instead of "Reward earned!", or null. */
  const handleRewardEarned = async (): Promise<TranslationKey | null> => {
    setClaiming(true);
    setError(null);
    const awarded = await claimDailyMission();
    setClaiming(false);
    if (awarded > 0) return null;
    // 0 with the mission marked done: the server already had today's claim,
    // most likely from another device. Otherwise the call itself failed.
    const message: TranslationKey = useWalletStore.getState().dailyMissionClaimedToday
      ? 'wallet.dailyMissionClaimedElsewhere'
      : 'wallet.dailyMissionError';
    setError(message);
    return message;
  };

  return (
    <>
      <LinearGradient colors={['#12331F', '#1E4A2E']} style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name={claimedToday ? 'checkmark-circle' : 'play-circle'} size={28} color={colors.success} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{t('wallet.dailyMission')}</Text>
          <Text style={styles.subtitle}>
            {claimedToday
              ? t('wallet.dailyMissionSubtitleClaimed')
              : t('wallet.dailyMissionSubtitleAvailable', { reward, symbol: BRAND.currency.coinSymbol })}
          </Text>
          {error && <Text style={styles.errorText}>{t(error)}</Text>}
        </View>
        <AppButton
          label={claimedToday ? t('wallet.claimed') : t('wallet.watchAd')}
          onPress={startMission}
          variant={claimedToday ? 'ghost' : 'gold'}
          disabled={claimedToday}
          loading={claiming}
          size="md"
        />
      </LinearGradient>

      <RewardedAdOverlay
        visible={adVisible}
        onRewardEarned={handleRewardEarned}
        onClose={() => setAdVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(61,220,132,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: { ...typography.bodyMedium, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  errorText: { ...typography.caption, color: colors.danger, marginTop: 4 },
});
