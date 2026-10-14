import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { SeriesRail } from '@/components/media';
import { BRAND } from '@/config';
import { useSeries } from '@/services/content';
import {
  useUserStore,
  useWalletStore,
  useSubscriptionStore,
  useLibraryStore,
  resetPrototype,
} from '@/store';
import { useTranslation } from '@/i18n/useTranslation';
import type { TranslationKey } from '@/i18n/translations';
import type { AuthProvider } from '@/types';
import { formatPhone } from '@/utils/phone';

const PROVIDER_LABEL: Record<AuthProvider, TranslationKey> = {
  guest: 'profile.via.guest',
  email: 'profile.via.email',
  phone: 'profile.via.phone',
  google: 'profile.via.google',
  apple: 'profile.via.apple',
};

const PROVIDER_ICON: Record<AuthProvider, React.ComponentProps<typeof Ionicons>['name']> = {
  guest: 'person-outline',
  email: 'mail-outline',
  phone: 'logo-whatsapp',
  google: 'logo-google',
  apple: 'logo-apple',
};

export default function ProfileScreen() {
  const user = useUserStore((s) => s.user);
  const signOut = useUserStore((s) => s.signOut);
  const balance = useWalletStore((s) => s.balance);
  const demoAddCoins = useWalletStore((s) => s.demoAddCoins);
  const setBalance = useWalletStore((s) => s.setBalance);
  const subscription = useSubscriptionStore();
  const clearHistory = useLibraryStore((s) => s.clearHistory);
  const lockAllPremium = useLibraryStore((s) => s.lockAllPremium);
  const unlockAll = useLibraryStore((s) => s.unlockAll);
  const favoriteSeriesIds = useLibraryStore((s) => s.favoriteSeriesIds);
  const { data: allSeries } = useSeries();
  const { t } = useTranslation();

  // In the order they were added (newest first), like Netflix's My List.
  const myList = useMemo(() => {
    const byId = new Map((allSeries ?? []).map((s) => [s.id, s]));
    return favoriteSeriesIds.flatMap((id) => byId.get(id) ?? []);
  }, [allSeries, favoriteSeriesIds]);

  const [demoExpanded, setDemoExpanded] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [editingName, setEditingName] = useState(false);
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
  const contact = user?.email ?? (user?.phone ? formatPhone(user.phone) : null);
  const initial = displayName.trim().charAt(0).toUpperCase() || BRAND.name.charAt(0);

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

        <View style={styles.profileHero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            {user && (
              <Pressable
                onPress={() => setEditingName(true)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('profile.editName')}
              >
                <Ionicons name="create-outline" size={18} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
          {contact ? <Text style={styles.email}>{contact}</Text> : null}
          {user && (
            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Ionicons name={PROVIDER_ICON[user.provider]} size={12} color={colors.textTertiary} />
                <Text style={styles.metaText}>{t(PROVIDER_LABEL[user.provider])}</Text>
              </View>
              {user.publicCode ? (
                <View style={styles.metaChip}>
                  <Text style={styles.metaText}>{t('profile.memberId', { id: user.publicCode })}</Text>
                </View>
              ) : null}
            </View>
          )}
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

        {user?.provider === 'guest' && (
          <Pressable
            onPress={() => router.push('/auth?mode=upgrade')}
            accessibilityRole="button"
            accessibilityLabel={t('profile.upgradeGuest')}
          >
            <LinearGradient colors={gradients.coralGlow} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.upgradeCard}>
              <View style={styles.upgradeIconWrap}>
                <Ionicons name="shield-checkmark" size={20} color={colors.white} />
              </View>
              <View style={styles.upgradeTextWrap}>
                <Text style={styles.upgradeTitle}>{t('profile.upgradeGuest')}</Text>
                <Text style={styles.upgradeSubtitle}>{t('profile.upgradeGuestSubtitle')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.white} />
            </LinearGradient>
          </Pressable>
        )}

        <Pressable onPress={() => router.push('/wallet')} accessibilityRole="button" accessibilityLabel="Open wallet">
          <LinearGradient colors={gradients.premiumBanner} style={styles.coinCard}>
            <View>
              <Text style={styles.coinLabel}>{t('profile.coinBalance')}</Text>
              <CoinBadge amount={balance} size="lg" />
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
          </LinearGradient>
        </Pressable>

        {myList.length > 0 && (
          // Bleeds past this screen's side padding: SeriesRail insets itself.
          <View style={styles.railBleed}>
            <SeriesRail title={t('series.myList')} series={myList} onSeeAll={() => router.push('/library')} />
          </View>
        )}

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
                <DemoButton label="+500 Coins" onPress={() => demoAddCoins(500)} />
                <DemoButton label="Remove All Coins" onPress={() => setBalance(0)} />
                <DemoButton label="Activate Membership" onPress={() => subscription.activate('monthly')} />
                <DemoButton label="Cancel Membership" onPress={() => subscription.cancel()} />
                <DemoButton label="Lock All Premium" onPress={() => lockAllPremium()} />
                <DemoButton label="Unlock All Episodes" onPress={() => unlockAll()} />
                <DemoButton label="Clear Viewing History" onPress={clearHistory} />
                <DemoButton label="Reset Entire Prototype" onPress={() => setConfirmVisible(true)} destructive />
              </View>
            )}
          </View>
        )}

        <Text style={styles.footerNote}>{t('profile.footerNote', { brand: BRAND.name })}</Text>
      </ScrollView>

      <EditNameModal visible={editingName} currentName={displayName} onClose={() => setEditingName(false)} />

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

function EditNameModal({ visible, currentName, onClose }: { visible: boolean; currentName: string; onClose: () => void }) {
  const { t } = useTranslation();
  const updateDisplayName = useUserStore((s) => s.updateDisplayName);
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setName(currentName);
      setError(null);
    }
  }, [visible, currentName]);

  const save = async () => {
    setSaving(true);
    const message = await updateDisplayName(name);
    setSaving(false);
    if (message) setError(message);
    else onClose();
  };

  return (
    <AppModal visible={visible} onClose={onClose}>
      <Text style={styles.editTitle}>{t('profile.editName')}</Text>
      <TextInput
        style={styles.editInput}
        value={name}
        onChangeText={setName}
        maxLength={40}
        autoFocus
        placeholder={t('profile.namePlaceholder')}
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel={t('profile.editName')}
        returnKeyType="done"
        onSubmitEditing={save}
      />
      {error && <Text style={styles.editError}>{error}</Text>}
      <View style={styles.editActions}>
        <AppButton label={t('profile.saveName')} onPress={save} variant="primary" fullWidth loading={saving} disabled={!name.trim()} />
        <AppButton label={t('common.cancel')} onPress={onClose} variant="ghost" fullWidth disabled={saving} />
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
  header: { ...typography.h1, color: colors.textPrimary },
  prototypeBadge: { backgroundColor: colors.info, paddingHorizontal: spacing.xs, paddingVertical: 3, borderRadius: radius.sm },
  prototypeBadgeText: { ...typography.micro, color: colors.white },
  profileHero: { alignItems: 'center', marginBottom: spacing.xl },
  // Netflix's profile tile: a large rounded square, not a circle.
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { ...typography.display, color: colors.white },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: '100%' },
  name: { ...typography.h2, color: colors.textPrimary, flexShrink: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xs },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  metaText: { ...typography.micro, color: colors.textTertiary },
  editTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md, textAlign: 'center' },
  editInput: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
  },
  editError: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  editActions: { width: '100%', gap: spacing.sm, marginTop: spacing.md },
  email: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  badgeRow: { flexDirection: 'row', marginTop: spacing.xs },
  railBleed: { marginHorizontal: -spacing.lg },
  freeBadge: { backgroundColor: colors.surfaceRaised, paddingHorizontal: spacing.xs, paddingVertical: 3, borderRadius: radius.sm },
  freeBadgeText: { ...typography.micro, color: colors.textTertiary },
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  upgradeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeTextWrap: { flex: 1 },
  upgradeTitle: { ...typography.bodyMedium, color: colors.white },
  upgradeSubtitle: { ...typography.caption, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
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
