import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';
import { AppButton } from '@/components/ui/AppButton';
import { BRAND } from '@/config';
import { useHaptics } from '@/hooks/useHaptics';

const AD_DURATION_SEC = 5;

interface RewardedAdOverlayProps {
  visible: boolean;
  onRewardEarned: () => void;
  onClose: () => void;
}

export function RewardedAdOverlay({ visible, onRewardEarned, onClose }: RewardedAdOverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState(AD_DURATION_SEC);
  const [rewardGranted, setRewardGranted] = useState(false);
  const { success } = useHaptics();

  useEffect(() => {
    if (!visible) {
      setSecondsLeft(AD_DURATION_SEC);
      setRewardGranted(false);
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [visible]);

  useEffect(() => {
    if (visible && secondsLeft === 0 && !rewardGranted) {
      setRewardGranted(true);
      success();
      onRewardEarned();
    }
  }, [secondsLeft, visible, rewardGranted, success, onRewardEarned]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (rewardGranted) onClose();
      }}
    >
      <LinearGradient colors={['#1A2B3C', '#0E1620']} style={styles.root}>
        <View style={styles.prototypeTag}>
          <Text style={styles.prototypeTagText}>SIMULATED ADVERTISEMENT — PROTOTYPE ONLY</Text>
        </View>

        <View style={styles.adCard}>
          <Ionicons name="megaphone" size={48} color={colors.info} />
          <Text style={styles.adBrand}>{BRAND.name} Partner Spotlight</Text>
          <Text style={styles.adCopy}>
            This is a placeholder rewarded-ad experience used only to demonstrate the unlock flow.
          </Text>
        </View>

        {!rewardGranted ? (
          <View style={styles.footer}>
            <View style={styles.countdownCircle}>
              <Text style={styles.countdownText}>{secondsLeft}</Text>
            </View>
            <Text style={styles.footerHint}>Reward unlocks when the countdown ends</Text>
          </View>
        ) : (
          <View style={styles.footer}>
            <View style={styles.rewardBadge}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.rewardText}>Reward earned!</Text>
            </View>
            <AppButton label="Close" onPress={onClose} variant="secondary" style={styles.closeButton} />
          </View>
        )}
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'space-between', padding: spacing.xl },
  prototypeTag: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
    marginTop: spacing.xl,
  },
  prototypeTagText: { ...typography.micro, color: colors.textTertiary, letterSpacing: 0.5 },
  adCard: { alignItems: 'center', gap: spacing.sm, maxWidth: 320 },
  adBrand: { ...typography.h2, color: colors.textPrimary, textAlign: 'center' },
  adCopy: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  footer: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  countdownCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: { ...typography.h2, color: colors.textPrimary },
  footerHint: { ...typography.caption, color: colors.textTertiary },
  rewardBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rewardText: { ...typography.h3, color: colors.success },
  closeButton: { minWidth: 160 },
});
