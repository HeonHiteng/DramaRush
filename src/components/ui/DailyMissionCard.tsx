import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, typography } from '@/theme';
import { AppButton } from '@/components/ui/AppButton';
import { RewardedAdOverlay } from '@/features/player/RewardedAdOverlay';
import { useWalletStore } from '@/store';
import { BRAND } from '@/config';

const DAILY_MISSION_REWARD = 20;

export function DailyMissionCard() {
  const claimedToday = useWalletStore((s) => s.dailyMissionClaimedToday);
  const claimDailyMission = useWalletStore((s) => s.claimDailyMission);
  const [adVisible, setAdVisible] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRewardEarned = async () => {
    setClaiming(true);
    setError(null);
    const awarded = await claimDailyMission();
    setClaiming(false);
    if (awarded === 0 && !useWalletStore.getState().dailyMissionClaimedToday) {
      setError("Couldn't claim your reward — check your connection and try again.");
    }
  };

  return (
    <>
      <LinearGradient colors={['#12331F', '#1E4A2E']} style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name={claimedToday ? 'checkmark-circle' : 'play-circle'} size={28} color={colors.success} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Daily Mission</Text>
          <Text style={styles.subtitle}>
            {claimedToday
              ? 'Come back tomorrow for more free coins.'
              : `Watch a short ad, earn ${DAILY_MISSION_REWARD} ${BRAND.currency.coinSymbol} free.`}
          </Text>
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
        <AppButton
          label={claimedToday ? 'Claimed' : 'Watch Ad'}
          onPress={() => setAdVisible(true)}
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
