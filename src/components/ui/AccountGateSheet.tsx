import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { BottomSheet } from './BottomSheet';
import { AppButton } from './AppButton';
import { BRAND } from '@/config';
import { usePublicConfig, DEFAULT_PUBLIC_CONFIG } from '@/services/content';
import { useAccountGateStore, type AccountGateReason } from '@/hooks/useAccountGate';
import { useUserStore } from '@/store/userStore';
import { useTranslation } from '@/i18n/useTranslation';
import type { TranslationKey } from '@/i18n/translations';

const REASON_KEYS: Record<AccountGateReason, TranslationKey> = {
  paywall: 'gate.reason.paywall',
  coins: 'gate.reason.coins',
  membership: 'gate.reason.membership',
  mission: 'gate.reason.mission',
  ad: 'gate.reason.ad',
  rpc: 'gate.reason.rpc',
};

/**
 * "Link an account to continue": what a guest sees instead of the paywall,
 * the coin shop, membership checkout or a reward. Opened through
 * useAccountGate().requireAccount(); mount one per screen — only the focused
 * screen's copy shows, so stacked screens don't draw it twice. Linking keeps
 * the guest's user id, so nothing they did as a guest is lost.
 */
export function AccountGateSheet() {
  const reason = useAccountGateStore((s) => s.reason);
  const close = useAccountGateStore((s) => s.close);
  const focused = useIsFocused();
  const hasSession = useUserStore((s) => s.user !== null);
  const { data: config } = usePublicConfig();
  const { t } = useTranslation();

  const welcomeCoins = config?.welcomeBonusCoins ?? DEFAULT_PUBLIC_CONFIG.welcomeBonusCoins;
  const benefits: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }[] = [
    { icon: 'lock-open', label: t('gate.benefitUnlockEpisodes') },
    {
      icon: 'sparkles',
      label: t('gate.benefitDailyCoins', { coins: welcomeCoins, unit: BRAND.currency.coinNamePlural.toLowerCase() }),
    },
    { icon: 'bookmark', label: t('gate.benefitKeepUnlocks') },
  ];

  const link = () => {
    close();
    // A guest links Google / WhatsApp to the current account (upgrade mode);
    // with no session at all there is nothing to link, so plain sign-in.
    router.push(hasSession ? '/auth?mode=upgrade' : '/auth');
  };

  return (
    <BottomSheet visible={focused && reason !== null} onClose={close}>
      <View style={styles.header}>
        <Ionicons name="person-add" size={20} color={colors.gold} />
        <Text style={styles.headerTitle}>{t('gate.title')}</Text>
      </View>
      {reason && <Text style={styles.body}>{t(REASON_KEYS[reason])}</Text>}

      <View style={styles.benefits}>
        {benefits.map((b) => (
          <View key={b.icon} style={styles.benefitRow}>
            <View style={styles.benefitIconWrap}>
              <Ionicons name={b.icon} size={14} color={colors.gold} />
            </View>
            <Text style={styles.benefitText}>{b.label}</Text>
          </View>
        ))}
      </View>

      <AppButton label={t('gate.link')} onPress={link} variant="primary" fullWidth style={styles.primaryAction} />
      <AppButton label={t('common.cancel')} onPress={close} variant="ghost" fullWidth />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  benefits: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  benefitIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { ...typography.body, color: colors.textSecondary, flex: 1 },
  primaryAction: { marginBottom: spacing.sm },
});
