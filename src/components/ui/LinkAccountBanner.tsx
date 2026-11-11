import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { usePublicConfig, DEFAULT_PUBLIC_CONFIG } from '@/services/content';
import { shouldShowLinkBanner, useSettingsStore } from '@/store/settingsStore';
import { useUserStore } from '@/store/userStore';
import { useTranslation } from '@/i18n/useTranslation';

/** False until the persisted close time has loaded — before that the banner
 * would flash up for a guest who closed it an hour ago. */
function useSettingsHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useSettingsStore.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    const unsubscribe = useSettingsStore.persist.onFinishHydration(() => setHydrated(true));
    // It may have finished between the first render and this effect.
    if (useSettingsStore.persist.hasHydrated()) setHydrated(true);
    return unsubscribe;
  }, [hydrated]);
  return hydrated;
}

/**
 * The guest's nudge at the top of Home: link Google / WhatsApp for the
 * welcome coins. Closing it hides it for 24 h, and for the rest of this
 * launch — see shouldShowLinkBanner in settingsStore. Members never see it.
 */
export function LinkAccountBanner() {
  const isGuest = useUserStore((s) => s.user?.provider === 'guest');
  const hydrated = useSettingsHydrated();
  const allowed = useSettingsStore((s) => shouldShowLinkBanner(s, Date.now()));
  const dismiss = useSettingsStore((s) => s.dismissLinkBanner);
  const { data: config } = usePublicConfig();
  const { t } = useTranslation();

  if (!isGuest || !hydrated || !allowed) return null;

  const coins = config?.welcomeBonusCoins ?? DEFAULT_PUBLIC_CONFIG.welcomeBonusCoins;
  const title = t('banner.link.title', { coins });

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="gift" size={18} color={colors.gold} />
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Pressable
          onPress={() => router.push('/auth?mode=upgrade')}
          accessibilityRole="button"
          accessibilityLabel={`${t('banner.link.cta')}: ${title}`}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaLabel} numberOfLines={1}>
            {t('banner.link.cta')}
          </Text>
        </Pressable>
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={t('banner.link.close')}
          hitSlop={12}
          style={styles.close}
        >
          <Ionicons name="close" size={16} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    maxHeight: 72,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceBorder,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.caption, color: colors.textPrimary, flex: 1 },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  ctaPressed: { backgroundColor: colors.accentPressed },
  ctaLabel: { ...typography.caption, fontWeight: '700', color: colors.white },
  close: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});
