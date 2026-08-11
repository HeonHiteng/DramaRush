import React, { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { StackHeader } from '@/components/ui/StackHeader';
import { AdminSeriesForm } from '@/components/admin/AdminSeriesForm';
import { useCreateSeries } from '@/services/content';
import { colors, spacing, typography } from '@/theme';

export default function NewSeriesScreen() {
  const createSeries = useCreateSeries();
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen>
      <StackHeader title="New Series" />
      {error && <Text style={{ color: colors.danger, ...typography.caption, paddingHorizontal: spacing.md }}>{error}</Text>}
      <AdminSeriesForm
        submitLabel="Create Series"
        submitting={createSeries.isPending}
        onSubmit={async (input) => {
          setError(null);
          try {
            await createSeries.mutateAsync(input);
            router.replace(`/admin/series/${input.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create series.');
          }
        }}
      />
    </Screen>
  );
}
