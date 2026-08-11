import React, { useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { StackHeader } from '@/components/ui/StackHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { AdminEpisodeForm } from '@/components/admin/AdminEpisodeForm';
import { useEpisodeById, useUpdateEpisode } from '@/services/content';
import { colors, spacing, typography } from '@/theme';

export default function EditEpisodeScreen() {
  const { id: seriesId, episodeId } = useLocalSearchParams<{ id: string; episodeId: string }>();
  const { data: episode, isLoading } = useEpisodeById(episodeId);
  const updateEpisode = useUpdateEpisode();
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Screen>
        <StackHeader title="Edit Episode" />
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.accent} />
      </Screen>
    );
  }

  if (!episode || !seriesId) {
    return (
      <Screen>
        <StackHeader title="Edit Episode" />
        <EmptyState icon="alert-circle-outline" title="Episode not found" />
      </Screen>
    );
  }

  return (
    <Screen>
      <StackHeader title={`EP${episode.number} · ${episode.title}`} />
      {error && <Text style={{ color: colors.danger, ...typography.caption, paddingHorizontal: spacing.md }}>{error}</Text>}
      <AdminEpisodeForm
        seriesId={seriesId}
        initial={episode}
        submitLabel="Save Changes"
        onSubmit={async (input) => {
          setError(null);
          try {
            await updateEpisode.mutateAsync(input);
            router.back();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save episode.');
          }
        }}
      />
    </Screen>
  );
}
