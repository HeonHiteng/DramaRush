import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { StackHeader } from '@/components/ui/StackHeader';
import { AppButton } from '@/components/ui/AppButton';
import { AppModal } from '@/components/ui/AppModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { AdminSeriesForm } from '@/components/admin/AdminSeriesForm';
import { useSeriesById, useEpisodesForSeries, useUpdateSeries, useDeleteSeries, useDeleteEpisode } from '@/services/content';
import { colors, spacing, typography } from '@/theme';
import type { Episode } from '@/types';

export default function EditSeriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: series, isLoading } = useSeriesById(id);
  const { data: episodes } = useEpisodesForSeries(id);
  const updateSeries = useUpdateSeries();
  const deleteSeries = useDeleteSeries();
  const deleteEpisode = useDeleteEpisode();

  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteSeries, setConfirmDeleteSeries] = useState(false);
  const [episodeToDelete, setEpisodeToDelete] = useState<Episode | null>(null);

  if (isLoading) {
    return (
      <Screen>
        <StackHeader title="Edit Series" />
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      </Screen>
    );
  }

  if (!series) {
    return (
      <Screen>
        <StackHeader title="Edit Series" />
        <EmptyState icon="alert-circle-outline" title="Series not found" />
      </Screen>
    );
  }

  return (
    <Screen>
      <StackHeader
        title={series.title}
        right={
          <Pressable onPress={() => setConfirmDeleteSeries(true)} accessibilityRole="button" accessibilityLabel="Delete series" hitSlop={8}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        }
      />
      <ScrollView>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <AdminSeriesForm
          initial={series}
          submitLabel="Save Changes"
          submitting={updateSeries.isPending}
          onSubmit={async (input) => {
            setError(null);
            try {
              await updateSeries.mutateAsync(input);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to save series.');
            }
          }}
        />

        <View style={styles.episodesHeader}>
          <Text style={styles.episodesTitle}>Episodes</Text>
          <AppButton
            label="New Episode"
            onPress={() => router.push(`/admin/series/${series.id}/episodes/new`)}
            icon={<Ionicons name="add" size={16} color={colors.textInverse} />}
            size="md"
          />
        </View>

        {(episodes ?? []).length === 0 ? (
          <EmptyState icon="videocam-outline" title="No episodes yet" subtitle="Add the first episode above." />
        ) : (
          (episodes ?? []).map((ep) => (
            <View key={ep.id} style={styles.episodeRow}>
              <Pressable
                style={styles.episodeInfo}
                onPress={() => router.push(`/admin/series/${series.id}/episodes/${ep.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Edit episode ${ep.number}, ${ep.title}`}
              >
                <Text style={styles.episodeTitle}>
                  EP{ep.number} · {ep.title}
                </Text>
                <Text style={styles.episodeMeta}>
                  {Math.round(ep.durationSec / 60)} min ·{' '}
                  {ep.access === 'coin' ? `${ep.coinPrice} coins` : ep.access.replace('_', ' ')}
                </Text>
              </Pressable>
              <Pressable onPress={() => setEpisodeToDelete(ep)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Delete episode ${ep.number}`}>
                <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <AppModal visible={confirmDeleteSeries} onClose={() => setConfirmDeleteSeries(false)}>
        <View style={styles.confirmIconWrap}>
          <Ionicons name="warning" size={26} color={colors.danger} />
        </View>
        <Text style={styles.confirmTitle}>Delete this series?</Text>
        <Text style={styles.confirmBody}>
          This permanently deletes &ldquo;{series.title}&rdquo; and all {episodes?.length ?? 0} of its episodes. This cannot be
          undone.
        </Text>
        <AppButton
          label="Delete Series"
          variant="danger"
          fullWidth
          loading={deleteSeries.isPending}
          style={styles.confirmAction}
          onPress={async () => {
            await deleteSeries.mutateAsync(series.id);
            router.replace('/admin');
          }}
        />
        <AppButton label="Cancel" variant="ghost" fullWidth onPress={() => setConfirmDeleteSeries(false)} />
      </AppModal>

      <AppModal visible={!!episodeToDelete} onClose={() => setEpisodeToDelete(null)}>
        <View style={styles.confirmIconWrap}>
          <Ionicons name="warning" size={26} color={colors.danger} />
        </View>
        <Text style={styles.confirmTitle}>Delete this episode?</Text>
        <Text style={styles.confirmBody}>
          &ldquo;{episodeToDelete?.title}&rdquo; will be permanently removed. This cannot be undone.
        </Text>
        <AppButton
          label="Delete Episode"
          variant="danger"
          fullWidth
          loading={deleteEpisode.isPending}
          style={styles.confirmAction}
          onPress={async () => {
            if (episodeToDelete) await deleteEpisode.mutateAsync(episodeToDelete.id);
            setEpisodeToDelete(null);
          }}
        />
        <AppButton label="Cancel" variant="ghost" fullWidth onPress={() => setEpisodeToDelete(null)} />
      </AppModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: spacing.xxl },
  errorText: { ...typography.caption, color: colors.danger, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  episodesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  episodesTitle: { ...typography.h3, color: colors.textPrimary },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  episodeInfo: { flex: 1 },
  episodeTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  episodeMeta: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  confirmIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    alignSelf: 'center',
  },
  confirmTitle: { ...typography.h3, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.xs },
  confirmBody: { ...typography.body, color: colors.textTertiary, textAlign: 'center', marginBottom: spacing.lg },
  confirmAction: { marginBottom: spacing.sm },
});
