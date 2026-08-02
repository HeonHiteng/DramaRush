import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { useHaptics } from '@/hooks/useHaptics';

interface GenreChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function GenreChip({ label, selected = false, onPress }: GenreChipProps) {
  const { selection } = useHaptics();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => {
        selection();
        onPress?.();
      }}
      style={[styles.chip, selected && styles.chipSelected]}
      hitSlop={4}
    >
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  chipSelected: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  label: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  labelSelected: {
    color: colors.accent,
  },
});
