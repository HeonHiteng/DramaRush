import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { colors, gradients, radius, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { MenuGroup, ProfileMenuItem } from '@/components/ui/ProfileMenuItem';
import { CoinBadge } from '@/components/ui/CoinBadge';
import { PremiumBadge } from '@/components/ui/PremiumBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppModal } from '@/components/ui/AppModal';
import { SeriesRail } from '@/components/media';
import { BRAND, DEFAULT_GUEST_NAME, DEFAULT_MEMBER_NAME } from '@/config';
import { useSeries } from '@/services/content';
import {
  useUserStore,
  useWalletStore,
  useSubscriptionStore,
  useLibraryStore,
  useSettingsStore,
  resetPrototype,
  deleteAccount,
} from '@/store';
import { useTranslation } from '@/i18n/useTranslation';
import { LANGUAGES, type TranslationKey } from '@/i18n/translations';
import type { AuthProvider } from '@/types';
import { formatPhone } from '@/utils/phone';
import { formatWatchTime, useViewingStats } from '@/hooks/useViewingStats';

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

const MEMBERSHIP_TILE = ['#3A2A12', '#5E4318'] as const;

const APP_VERSION = Constants.expoConfig?.version ?? null;

/** The label the backend writes on the one-time link bonus transaction. */
const WELCOME_BONUS_LABEL = 'Welcome bonus';

export default function ProfileScreen() {
  const user = useUserStore((s) => s.user);
  const signOut = useUserStore((s) => s.signOut);
  const pendingWelcome = useUserStore((s) => s.pendingWelcome);
  const balance = useWalletStore((s) => s.balance);
  const demoAddCoins = useWalletStore((s) => s.demoAddCoins);
  const setBalance = useWalletStore((s) => s.setBalance);
  const subscription = useSubscriptionStore();
  const clearHistory = useLibraryStore((s) => s.clearHistory);
  const lockAllPremium = useLibraryStore((s) => s.lockAllPremium);
  const unlockAll = useLibraryStore((s) => s.unlockAll);
  const favoriteSeriesIds = useLibraryStore((s) => s.favoriteSeriesIds);
  const { data: allSeries } = useSeries();
  const language = useSettingsStore((s) => s.language);
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
  // Account deletion is two explicit steps: what it means, then "are you sure".
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Set once after a guest links Google/WhatsApp (see userStore.pendingWelcome);
  // `coins` is null when no welcome bonus was granted (e.g. that identity
  // already received one before), so we don't promise coins that aren't there.
  const [welcome, setWelcome] = useState<{ coins: number | null } | null>(null);
  const isGuest = user?.provider === 'guest';
  const showDevTools = __DEV__ && !!user?.isAdmin;

  useEffect(() => {
    if (!pendingWelcome) return;
    useUserStore.setState({ pendingWelcome: false });
    (async () => {
      // The server grants the bonus as the identity is linked; re-read the
      // wallet so the balance on this screen already includes it.
      await useWalletStore.getState().hydrateFromServer();
      const bonus = useWalletStore
        .getState()
        .transactions.find((tx) => tx.type === 'bonus' && tx.label === WELCOME_BONUS_LABEL);
      setWelcome({ coins: bonus ? bonus.amount : null });
    })();
  }, [pendingWelcome]);

  const handleReset = async () => {
    setResetting(true);
    await resetPrototype();
    setResetting(false);
    setConfirmVisible(false);
    router.replace('/onboarding');
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteStep(0);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    const ok = await deleteAccount();
    setDeleting(false);
    if (!ok) {
      setDeleteError(t('profile.deleteFailed'));
      return;
    }
    setDeleteStep(0);
    router.replace('/onboarding');
  };

  // Members only: a guest has no way back into their account once signed
  // out, so Profile offers them "Link an Account" instead.
  const confirmSignOut = () => {
    if (Platform.OS === 'web') {
      signOut().then(() => router.replace('/auth'));
      return;
    }
    Alert.alert(t('profile.signOutTitle'), t('profile.signOutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.signOut'),
        style: 'destructive',
        onPress: () => {
          signOut().then(() => router.replace('/auth'));
        },
      },
    ]);
  };

  // The backend's placeholder names are stored in English; show them in the
  // interface language until the user picks a name of their own.
  const displayName =
    !user || user.displayName === DEFAULT_GUEST_NAME
      ? t('profile.guestName')
      : user.displayName === DEFAULT_MEMBER_NAME
        ? t('profile.memberName', { brand: BRAND.name })
        : user.displayName;
  const contact = user?.email ?? (user?.phone ? formatPhone(user.phone) : null);
  const initial = displayName.trim().charAt(0).toUpperCase() || BRAND.name.charAt(0);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Text style={styles.header}>{t('profile.title')}</Text>
          {__DEV__ && (
            <View style={styles.prototypeBadge}>
              <Text style={styles.prototypeBadgeText}>{t('profile.prototypeBadge')}</Text>
            </View>
          )}
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.profileInfo}>
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
            {contact ? (
              <Text style={styles.email} numberOfLines={1}>
                {contact}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              {subscription.isActive ? (
                <PremiumBadge compact />
              ) : (
                <View style={styles.freeBadge}>
                  <Text style={styles.freeBadgeText}>{t('profile.freeMember')}</Text>
                </View>
              )}
              {user && (
                <View style={styles.metaChip}>
                  <Ionicons name={PROVIDER_ICON[user.provider]} size={12} color={colors.textTertiary} />
                  <Text style={styles.metaText}>{t(PROVIDER_LABEL[user.provider])}</Text>
                </View>
              )}
              {user?.publicCode ? (
                <View style={styles.metaChip}>
                  <Text style={styles.metaText}>{t('profile.memberId', { id: user.publicCode })}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {isGuest && (
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

        <View style={styles.tileStack}>
          <Pressable onPress={() => router.push('/wallet')} accessibilityRole="button" accessibilityLabel={t('profile.openWallet')}>
            <LinearGradient colors={gradients.premiumBanner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tile}>
              <View style={styles.tileBody}>
                <Text style={styles.tileLabel}>{t('profile.coins')}</Text>
                <CoinBadge amount={balance} size="lg" />
              </View>
              <View style={styles.tileAction}>
                <Text style={styles.tileActionText}>{t('profile.topUp')}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textPrimary} />
              </View>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={() => router.push('/subscription')} accessibilityRole="button" accessibilityLabel={t('profile.membership')}>
            <LinearGradient colors={MEMBERSHIP_TILE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tile}>
              <View style={styles.tileBody}>
                <Text style={styles.tileLabel}>{t('profile.membership')}</Text>
                <View style={styles.tilePlanRow}>
                  <Ionicons name="diamond" size={18} color={colors.gold} />
                  <Text style={styles.tilePlan} numberOfLines={1}>
                    {subscription.isActive
                      ? subscription.planId === 'annual'
                        ? t('profile.annual')
                        : t('profile.monthly')
                      : t('profile.freePlan')}
                  </Text>
                </View>
              </View>
              <View style={styles.tileAction}>
                <Text style={styles.tileActionText}>{subscription.isActive ? t('profile.manage') : t('profile.join')}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textPrimary} />
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        {myList.length > 0 && (
          // Bleeds past this screen's side padding: SeriesRail insets itself.
          <View style={styles.railBleed}>
            <SeriesRail title={t('series.myList')} series={myList} onSeeAll={() => router.push('/library')} />
          </View>
        )}

        <ViewingCard />

        <View style={styles.section}>
          <MenuGroup>
            <ProfileMenuItem icon="wallet-outline" label={t('profile.wallet')} onPress={() => router.push('/wallet')} />
          </MenuGroup>
        </View>

        <Text style={styles.groupLabel}>{t('profile.settings')}</Text>
        <View style={styles.section}>
          <MenuGroup>
            <ProfileMenuItem icon="notifications-outline" label={t('profile.notificationSettings')} onPress={() => router.push('/settings/notifications')} />
            <ProfileMenuItem icon="play-circle-outline" label={t('profile.playbackSettings')} onPress={() => router.push('/settings/playback')} />
            <ProfileMenuItem
              icon="language-outline"
              label={t('profile.language')}
              value={LANGUAGES.find((l) => l.code === language)?.label}
              onPress={() => router.push('/settings/language')}
            />
          </MenuGroup>
        </View>

        <Text style={styles.groupLabel}>{t('profile.support')}</Text>
        <View style={styles.section}>
          <MenuGroup>
            <ProfileMenuItem icon="help-circle-outline" label={t('profile.helpSupport')} onPress={() => router.push('/settings/help')} />
            <ProfileMenuItem icon="document-text-outline" label={t('profile.termsOfService')} onPress={() => router.push('/settings/legal?type=terms')} />
            <ProfileMenuItem icon="shield-checkmark-outline" label={t('profile.privacyPolicy')} onPress={() => router.push('/settings/legal?type=privacy')} />
          </MenuGroup>
        </View>

        {user?.isAdmin && (
          <>
            <Text style={styles.groupLabel}>{t('profile.admin')}</Text>
            <View style={styles.section}>
              <MenuGroup>
                <ProfileMenuItem icon="film-outline" label={t('profile.contentAdmin')} onPress={() => router.push('/admin')} />
              </MenuGroup>
            </View>
          </>
        )}

        {user && (
          <View style={styles.section}>
            <MenuGroup>
              {!isGuest && <ProfileMenuItem icon="log-out-outline" label={t('profile.signOut')} onPress={confirmSignOut} />}
              <ProfileMenuItem
                icon="person-remove-outline"
                label={isGuest ? t('profile.deleteGuestData') : t('profile.deleteAccount')}
                destructive
                onPress={() => setDeleteStep(1)}
              />
              {/* reset_my_data is refused once simulated payments are off, so
                  this is a developer tool, not something to show customers. */}
              {showDevTools && (
                <ProfileMenuItem icon="trash-outline" label={t('profile.resetPrototype')} destructive onPress={() => setConfirmVisible(true)} />
              )}
            </MenuGroup>
          </View>
        )}

        {showDevTools && (
          <View style={styles.demoSection}>
            <Pressable
              style={styles.demoHeader}
              onPress={() => setDemoExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={t('profile.demoToggle')}
            >
              <View style={styles.demoHeaderLeft}>
                <Ionicons name="construct" size={16} color={colors.info} />
                <Text style={styles.demoTitle}>{t('profile.demoTitle')}</Text>
              </View>
              <Ionicons name={demoExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
            </Pressable>
            <Text style={styles.demoSubtitle}>{t('profile.demoSubtitle')}</Text>

            {demoExpanded && (
              <View style={styles.demoGrid}>
                <DemoButton label={t('profile.demoAddCoins', { amount: 500 })} onPress={() => demoAddCoins(500)} />
                <DemoButton label={t('profile.demoRemoveCoins')} onPress={() => setBalance(0)} />
                <DemoButton label={t('profile.demoActivate')} onPress={() => subscription.activate('monthly')} />
                <DemoButton label={t('profile.demoCancel')} onPress={() => subscription.cancel()} />
                <DemoButton label={t('profile.demoLockAll')} onPress={() => lockAllPremium()} />
                <DemoButton label={t('profile.demoUnlockAll')} onPress={() => unlockAll()} />
                <DemoButton label={t('profile.demoClearHistory')} onPress={clearHistory} />
                <DemoButton label={t('profile.demoReset')} onPress={() => setConfirmVisible(true)} destructive />
              </View>
            )}
          </View>
        )}

        <Text style={styles.footerNote}>{t('profile.footerNote', { brand: BRAND.name })}</Text>
        {APP_VERSION ? (
          <Text style={styles.versionNote}>
            {BRAND.name} · {t('profile.version', { version: APP_VERSION })}
          </Text>
        ) : null}
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

      <AppModal visible={deleteStep !== 0} onClose={closeDelete}>
        <View style={styles.confirmIconWrap}>
          <Ionicons name="warning" size={26} color={colors.danger} />
        </View>
        {deleteStep === 1 ? (
          <>
            <Text style={styles.confirmTitle}>{isGuest ? t('profile.deleteGuestTitle') : t('profile.deleteTitle')}</Text>
            <Text style={styles.confirmBody}>{isGuest ? t('profile.deleteGuestBody') : t('profile.deleteBody')}</Text>
            <AppButton
              label={t('profile.deleteContinue')}
              onPress={() => setDeleteStep(2)}
              variant="secondary"
              fullWidth
              style={styles.confirmAction}
            />
          </>
        ) : (
          <>
            <Text style={styles.confirmTitle}>{t('profile.deleteConfirmTitle')}</Text>
            <Text style={styles.confirmBody}>{t('profile.deleteConfirmBody')}</Text>
            {deleteError && <Text style={styles.confirmError}>{deleteError}</Text>}
            <AppButton
              label={t('profile.deleteConfirm')}
              onPress={handleDelete}
              variant="danger"
              fullWidth
              loading={deleting}
              style={styles.confirmAction}
            />
          </>
        )}
        <AppButton label={t('common.cancel')} onPress={closeDelete} variant="ghost" fullWidth disabled={deleting} />
      </AppModal>

      <AppModal visible={welcome !== null} onClose={() => setWelcome(null)}>
        <View style={styles.welcomeIconWrap}>
          <Ionicons name="checkmark-circle" size={28} color={colors.gold} />
        </View>
        <Text style={styles.confirmTitle}>{t('profile.linkedTitle')}</Text>
        <Text style={styles.confirmBody}>
          {welcome?.coins
            ? t('profile.linkedBonus', { coins: welcome.coins, unit: BRAND.currency.coinNamePlural.toLowerCase() })
            : t('profile.linkedBody')}
        </Text>
        <AppButton label={t('common.ok')} onPress={() => setWelcome(null)} variant="primary" fullWidth />
      </AppModal>
    </Screen>
  );
}

/** Watch time plus Watching / Finished / History counts, each opening that
 * list on the My Viewing screen. Separate pressables, not one big button,
 * so web doesn't nest <button>s. */
function ViewingCard() {
  const stats = useViewingStats();
  const { t } = useTranslation();
  const cells: { tab: string; label: TranslationKey; count: number }[] = [
    { tab: 'watching', label: 'viewing.watching', count: stats.watching.length },
    { tab: 'finished', label: 'viewing.finished', count: stats.finished.length },
    { tab: 'history', label: 'viewing.history', count: stats.all.length },
  ];

  return (
    <View style={styles.viewingCard}>
      <Pressable
        onPress={() => router.push('/viewing')}
        style={styles.viewingHeader}
        accessibilityRole="button"
        accessibilityLabel={t('viewing.title')}
      >
        <View style={styles.viewingIcon}>
          <Ionicons name="time" size={16} color={colors.accent} />
        </View>
        <View style={styles.viewingHeaderText}>
          <Text style={styles.viewingTitle}>{t('viewing.watchTime')}</Text>
          <Text style={styles.viewingSub}>{t('viewing.thisMonth', { time: formatWatchTime(stats.monthSec, t) })}</Text>
        </View>
        <Text style={styles.viewingTotal}>{formatWatchTime(stats.totalSec, t)}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </Pressable>
      <View style={styles.viewingCells}>
        {cells.map((cell, i) => (
          <Pressable
            key={cell.tab}
            onPress={() => router.push({ pathname: '/viewing', params: { tab: cell.tab } })}
            style={[styles.viewingCell, i > 0 && styles.viewingCellBorder]}
            accessibilityRole="button"
            accessibilityLabel={`${t(cell.label)}: ${t('viewing.seriesCount', { count: cell.count })}`}
          >
            <Text style={styles.viewingCount}>{cell.count}</Text>
            <Text style={styles.viewingCellLabel}>{t(cell.label)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
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
    const errorKey = await updateDisplayName(name);
    setSaving(false);
    if (errorKey) setError(t(errorKey));
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  // Netflix's profile tile: a rounded square, not a circle.
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.h1, color: colors.white },
  profileInfo: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: '100%' },
  name: { ...typography.h2, color: colors.textPrimary, flexShrink: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xxs, marginTop: spacing.xs },
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
  tileStack: { gap: spacing.sm, marginBottom: spacing.lg },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  tileBody: { flex: 1, minWidth: 0, gap: spacing.xxs },
  tileLabel: { ...typography.caption, color: 'rgba(255,255,255,0.7)' },
  tilePlanRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 36 },
  tilePlan: { ...typography.h3, color: colors.white, flexShrink: 1 },
  tileAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  tileActionText: { ...typography.bodyMedium, color: colors.textPrimary },
  section: { marginBottom: spacing.lg },
  viewingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  viewingHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  viewingIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewingHeaderText: { flex: 1, minWidth: 0 },
  viewingTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  viewingSub: { ...typography.caption, color: colors.textTertiary, marginTop: 1 },
  viewingTotal: { ...typography.h3, color: colors.textPrimary },
  viewingCells: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
  },
  viewingCell: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  viewingCellBorder: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.borderStrong },
  viewingCount: { ...typography.h2, color: colors.textPrimary },
  viewingCellLabel: { ...typography.caption, color: colors.textTertiary, marginTop: 1 },
  groupLabel: {
    ...typography.micro,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
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
  versionNote: { ...typography.micro, color: colors.textDisabled, textAlign: 'center', marginTop: spacing.xs },
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
  confirmError: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  welcomeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(244,185,66,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
});
