import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { StackHeader } from '@/components/ui/StackHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PosterArt } from '@/components/media';
import { formatWatchTime, useViewingStats } from '@/hooks/useViewingStats';
import { formatRelativeDate } from '@/utils/format';
import { useTranslation } from '@/i18n/useTranslation';
import type { TranslationKey } from '@/i18n/translations';
import type { SeriesViewing } from '@/utils/viewingStats';

type ViewingTab = 'watching' | 'finished' | 'history';

const TABS: { key: ViewingTab; label: TranslationKey; empty: TranslationKey; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'watching', label: 'viewing.watching', empty: 'viewing.emptyWatching', icon: 'play-circle-outline' },
  { key: 'finished', label: 'viewing.finished', empty: 'viewing.emptyFinished', icon: 'checkmark-circle-outline' },
  { key: 'history', label: 'viewing.history', empty: 'viewing.emptyHistory', icon: 'time-outline' },
];

function isViewingTab(value: string | undefined): value is ViewingTab {
  return value === 'watching' || value === 'finished' || value === 'history';
}

/** What the viewer has watched: total watch time, series in progress,
 * series finished, and everything they've played. Opened from Profile. */
export default function ViewingScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<ViewingTab>(isViewingTab(params.tab) ? params.tab : 'watching');
  const stats = useViewingStats();
  const { t } = useTranslation();

  const lists: Record<ViewingTab, SeriesViewing[]> = {
    watching: stats.watching,
    finished: stats.finished,
    history: stats.all,
  };
  const current = TABS.find((x) => x.key === tab)!;
  const list = lists[tab];

  return (
    <Screen>
      <StackHeader title={t('viewing.title')} fallback="/(tabs)/profile" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>{t('viewing.watchTime')}</Text>
          <Text style={styles.summaryValue}>{formatWatchTime(stats.totalSec, t)}</Text>
          <Text style={styles.summarySub}>{t('viewing.thisMonth', { time: formatWatchTime(stats.monthSec, t) })}</Text>
        </View>

        <View style={styles.tabs} accessibilityRole="tablist">
          {TABS.map((x) => {
            const active = x.key === tab;
            return (
              <Pressable
                key={x.key}
                onPress={() => setTab(x.key)}
                style={[styles.tab, active && styles.tabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                  {t(x.label)} · {lists[x.key].length}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {list.length === 0 ? (
          <EmptyState icon={current.icon} title={t(current.empty)} />
        ) : (
          list.map((item) => <ViewingRow key={item.series.id} item={item} />)
        )}
      </ScrollView>
    </Screen>
  );
}

function ViewingRow({ item }: { item: SeriesViewing }) {
  const { t } = useTranslation();
  const { series, nextEpisode } = item;
  const fraction = item.totalEpisodes > 0 ? item.completedEpisodes / item.totalEpisodes : 0;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.push(`/series/${series.id}`)}
        style={styles.rowMain}
        accessibilityRole="button"
        accessibilityLabel={series.title}
      >
        <LinearGradient colors={[series.posterColorFrom, series.posterColorTo]} style={styles.thumb}>
          {series.posterImageUri ? (
            <Image source={{ uri: series.posterImageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <PosterArt series={series} />
          )}
        </LinearGradient>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {series.title}
          </Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {t('viewing.episodesProgress', { done: item.completedEpisodes, total: item.totalEpisodes })}
          </Text>
          <ProgressBar progress={fraction} height={3} style={styles.rowProgress} fillColor={item.finished ? colors.success : colors.accent} />
          <Text style={styles.rowMeta} numberOfLines={1}>
            {formatWatchTime(item.watchedSec, t)} · {formatRelativeDate(item.lastWatchedAt)}
          </Text>
        </View>
      </Pressable>
      {nextEpisode && (
        <Pressable
          onPress={() => router.push(`/player/${nextEpisode.id}`)}
          style={styles.playButton}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${item.finished ? t('viewing.rewatch') : t('viewing.resume')}: ${series.title}`}
        >
          <Ionicons name={item.finished ? 'refresh' : 'play'} size={14} color={colors.textInverse} />
          <Text style={styles.playText}>{item.finished ? t('viewing.rewatch') : t('viewing.resume')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryLabel: { ...typography.caption, color: colors.textTertiary },
  summaryValue: { ...typography.h1, color: colors.textPrimary, marginTop: 2 },
  summarySub: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.md,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs, borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.textPrimary },
  tabText: { ...typography.caption, fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: colors.textInverse },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  thumb: { width: 56, height: 80, borderRadius: radius.sm, overflow: 'hidden' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  rowSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  rowProgress: { marginTop: spacing.xs, borderRadius: 2 },
  rowMeta: { ...typography.micro, color: colors.textTertiary, marginTop: spacing.xs },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  playText: { ...typography.caption, fontWeight: '700', color: colors.textInverse },
});
