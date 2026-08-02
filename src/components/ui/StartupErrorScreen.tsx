import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';
import { BRAND } from '@/config';

export function StartupErrorScreen({ message }: { message: string }) {
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="warning" size={28} color={colors.danger} />
        </View>
        <Text style={styles.title}>{BRAND.name} couldn&apos;t start</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.hintBox}>
          <Text style={styles.hintText}>
            This usually means the Supabase backend isn&apos;t configured yet. See the app repo&apos;s
            README (Setup) and the DramaRush-Backend repo for the one-time steps.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(232,71,76,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...typography.h2, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 360,
  },
  hintBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    maxWidth: 360,
  },
  hintText: { ...typography.caption, color: colors.textTertiary, textAlign: 'center' },
});
