import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { colors, gradients, radius, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { ProfileMenuItem } from '@/components/ui/ProfileMenuItem';
import { CoinBadge } from '@/components/ui/CoinBadge';
import { PremiumBadge } from '@/components/ui/PremiumBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppModal } from '@/components/ui/AppModal';
import { BRAND } from '@/config';
import {
  useUserStore,
  useWalletStore,
  useSubscriptionStore,
  useLibraryStore,
  resetPrototype,
} from '@/store';
import { useEpisodes } from '@/services/content';
import { useTranslation } from '@/i18n/useTranslation';

export default function ProfileScreen() {
  const user = useUserStore((s) => s.user);
  const signOut = useUserStore((s) => s.signOut);
  const balance = useWalletStore((s) => s.balance);
  const addCoins = useWalletStore((s) => s.addCoins);
  const setBalance = useWalletStore((s) => s.setBalance);
  const subscription = useSubscriptionStore();
  const clearHistory = useLibraryStore((s) => s.clearHistory);
  const lockAllPremium = useLibraryStore((s) => s.lockAllPremium);
  const unlockAll = useLibraryStore((s) => s.unlockAll);
  const { data: allEpisodes = [] } = useEpisodes();
  const { t } = useTranslation();

  const premiumEpisodeIds = useMemo(() => allEpisodes.filter((e) => e.access !== 'free').map((e) => e.id), [allEpisodes]);
  const allEpisodeIds = useMemo(() => allEpisodes.map((e) => e.id), [allEpisodes]);

  const [demoExpanded, setDemoExpanded] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    await resetPrototype();
    setResetting(false);
    setConfirmVisible(false);
    router.replace('/onboarding');
  };

  const confirmSignOut = () => {
    if (Platform.OS === 'web') {
      signOut().then(() => router.replace('/auth'));
      return;
    }
    Alert.alert('Sign out', 'You can sign back in anytime with any option.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          signOut().then(() => router.replace('/auth'));
        },
      },
    ]);
  };

  const displayName = user?.displayName ?? 'Guest Viewer';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'D';

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Text style={styles.header}>{t('profile.title')}</Text>
          {__DEV__ && (
            <View style={styles.prototypeBadge}>
              <Text style={styles.prototypeBadgeText}>PROTOTYPE</Text>
            </View>
          )}
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{displayName}</Text>
            {user?.email && <Text style={styles.email}>{user.email}</Text>}
            <View style={styles.badgeRow}>
              {subscription.isActive ? (
                <PremiumBadge compact />
              ) : (
                <View style={styles.freeBadge}>
                  <Text style={styles.freeBadgeText}>{t('profile.freeMember')}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <Pressable onPress={() => router.push('/wallet')} accessibilityRole="button" accessibilityLabel="Open wallet">
          <LinearGradient colors={gradients.premiumBanner} style={styles.coinCard}>
            <View>
              <Text style={styles.coinLabel}>{t('profile.coinBalance')}</Text>
              <CoinBadge amount={balance} size="lg" />
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
          </LinearGradient>
        </Pressable>

        <View style={styles.menuGroup}>
          <ProfileMenuItem icon="time-outline" label={t('profile.watchHistory')} onPress={() => router.push('/library')} />
          <ProfileMenuItem icon="wallet-outline" label={t('profile.wallet')} onPress={() => router.push('/wallet')} />
          <ProfileMenuItem
            icon="diamond-outline"
            label={t('profile.subscription')}
            value={
              subscription.isActive
                ? subscription.planId === 'annual'
                  ? t('profile.annual')
                  : t('profile.monthly')
                : t('profile.none')
            }
            onPress={() => router.push('/subscription')}
          />
        </View>

        <Text style={styles.groupLabel}>{t('profile.settings')}</Text>
        <View style={styles.menuGroup}>
          <ProfileMenuItem icon="notifications-outline" label={t('profile.notificationSettings')} onPress={() => router.push('/settings/notifications')} />
          <ProfileMenuItem icon="play-circle-outline" label={t('profile.playbackSettings')} onPress={() => router.push('/settings/playback')} />
          <ProfileMenuItem icon="language-outline" label={t('profile.language')} onPress={() => router.push('/settings/language')} />
        </View>

        <Text style={styles.groupLabel}>{t('profile.support')}</Text>
        <View style={styles.menuGroup}>
          <ProfileMenuItem icon="help-circle-outline" label={t('profile.helpSupport')} onPress={() => router.push('/settings/help')} />
          <ProfileMenuItem icon="document-text-outline" label={t('profile.termsOfService')} onPress={() => router.push('/settings/legal?type=terms')} />
          <ProfileMenuItem icon="shield-checkmark-outline" label={t('profile.privacyPolicy')} onPress={() => router.push('/settings/legal?type=privacy')} />
        </View>

        {user?.isAdmin && (
          <>
            <Text style={styles.groupLabel}>{t('profile.admin')}</Text>
            <View style={styles.menuGroup}>
              <ProfileMenuItem icon="film-outline" label={t('profile.contentAdmin')} onPress={() => router.push('/admin')} />
            </View>
          </>
        )}

        <View style={styles.menuGroup}>
          <ProfileMenuItem icon="log-out-outline" label={t('profile.signOut')} onPress={confirmSignOut} />
          <ProfileMenuItem icon="trash-outline" label={t('profile.resetPrototype')} destructive onPress={() => setConfirmVisible(true)} />
        </View>

        {__DEV__ && (
          <View style={styles.demoSection}>
            <Pressable
              style={styles.demoHeader}
              onPress={() => setDemoExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Toggle demo controls"
            >
              <View style={styles.demoHeaderLeft}>
                <Ionicons name="construct" size={16} color={colors.info} />
                <Text style={styles.demoTitle}>Demo Controls</Text>
              </View>
              <Ionicons name={demoExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
            </Pressable>
            <Text style={styles.demoSubtitle}>For client demonstrations only — not visible in production builds.</Text>

            {demoExpanded && (
              <View style={styles.demoGrid}>
                <DemoButton label="+500 Coins" onPress={() => addCoins(500, 'Demo: added coins', 'bonus')} />
                <DemoButton label="Remove All Coins" onPress={() => setBalance(0)} />
                <DemoButton label="Activate Membership" onPress={() => subscription.activate('monthly')} />
                <DemoButton label="Cancel Membership" onPress={() => subscription.cancel()} />
                <DemoButton label="Lock All Premium" onPress={() => lockAllPremium(premiumEpisodeIds)} />
                <DemoButton label="Unlock All Episodes" onPress={() => unlockAll(allEpisodeIds)} />
                <DemoButton label="Clear Viewing History" onPress={clearHistory} />
                <DemoButton label="Reset Entire Prototype" onPress={() => setConfirmVisible(true)} destructive />
              </View>
            )}
          </View>
        )}

        <Text style={styles.footerNote}>{t('profile.footerNote', { brand: BRAND.name })}</Text>
      </ScrollView>

      <AppModal visible={confirmVisible} onClose={() => setConfirmVisible(false)}>
        <View style={styles.confirmIconWrap}>
          <Ionicons name="warning" size={26} color={colors.danger} />
        </View>
        <Text style={styles.confirmTitle}>{t('profile.confirmResetTitle')}</Text>
        <Text style={styles.confirmBody}>{t('profile.confirmResetBody')}</Text>
        <AppButton
          label={t('profile.resetEverything')}
          onPress={handleReset}
          variant="danger"
          fullWidth
          loading={resetting}
          style={styles.confirmAction}
        />
        <AppButton label={t('common.cancel')} onPress={() => setConfirmVisible(false)} variant="ghost" fullWidth />
      </AppModal>
    </Screen>
  );
}

function DemoButton({ label, onPress, destructive }: { label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.demoButton, destructive && styles.demoButtonDanger]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.demoButtonText, destructive && styles.demoButtonTextDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
  header: { ...typography.h1, color: colors.textPrimary },
  prototypeBadge: { backgroundColor: colors.info, paddingHorizontal: spacing.xs, paddingVertical: 3, borderRadius: radius.sm },
  prototypeBadgeText: { ...typography.micro, color: colors.white },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.h1, color: colors.white },
  profileInfo: { flex: 1 },
  name: { ...typography.h2, color: colors.textPrimary },
  email: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  badgeRow: { flexDirection: 'row', marginTop: spacing.xs },
  freeBadge: { backgroundColor: colors.surfaceRaised, paddingHorizontal: spacing.xs, paddingVertical: 3, borderRadius: radius.sm },
  freeBadgeText: { ...typography.micro, color: colors.textTertiary },
  coinCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  coinLabel: { ...typography.caption, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  menuGroup: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    paddingVertical: spacing.xxs,
  },
  groupLabel: { ...typography.caption, color: colors.textTertiary, marginBottom: spacing.xs, marginLeft: spacing.xs },
  demoSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.info,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  demoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  demoHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  demoTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  demoSubtitle: { ...typography.caption, color: colors.textTertiary, marginTop: 4 },
  demoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  demoButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  demoButtonDanger: { borderColor: colors.danger, backgroundColor: 'rgba(232,71,76,0.1)' },
  demoButtonText: { ...typography.caption, color: colors.textSecondary },
  demoButtonTextDanger: { color: colors.danger },
  footerNote: { ...typography.caption, color: colors.textDisabled, textAlign: 'center', marginTop: spacing.md },
  confirmIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(232,71,76,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  confirmTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  confirmBody: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  confirmAction: { marginBottom: spacing.sm },
});
