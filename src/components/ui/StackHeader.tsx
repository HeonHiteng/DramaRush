import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, typography } from '@/theme';

interface StackHeaderProps {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function StackHeader({ title, onBack, right }: StackHeaderProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={10}
        style={styles.iconButton}
      >
        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h3, color: colors.textPrimary, flex: 1 },
  right: { minWidth: 36, alignItems: 'flex-end' },
});
