import React, { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { StackHeader } from '@/components/ui/StackHeader';
import { AdminEpisodeForm } from '@/components/admin/AdminEpisodeForm';
import { useCreateEpisode, useEpisodesForSeries } from '@/services/content';
import { colors, spacing, typography } from '@/theme';
import { goBack } from '@/utils/navigation';

export default function NewEpisodeScreen() {
  const { id: seriesId } = useLocalSearchParams<{ id: string }>();
  const { data: episodes } = useEpisodesForSeries(seriesId);
  const createEpisode = useCreateEpisode();
  const [error, setError] = useState<string | null>(null);

  const nextNumber = useMemo(() => (episodes && episodes.length > 0 ? Math.max(...episodes.map((e) => e.number)) + 1 : 1), [episodes]);

  if (!seriesId) return null;

  return (
    <Screen>
      <StackHeader title="New Episode" />
      {error && <Text style={{ color: colors.danger, ...typography.caption, paddingHorizontal: spacing.md }}>{error}</Text>}
      <AdminEpisodeForm
        seriesId={seriesId}
        defaultNumber={nextNumber}
        submitLabel="Create Episode"
        onSubmit={async (input) => {
          setError(null);
          try {
            await createEpisode.mutateAsync(input);
            goBack(`/admin/series/${seriesId}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create episode.');
          }
        }}
      />
    </Screen>
  );
}
