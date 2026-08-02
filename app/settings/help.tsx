import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { StackHeader } from '@/components/ui/StackHeader';
import { BRAND } from '@/config';

const FAQS = [
  {
    q: 'Are payments real in this app?',
    a: 'No. Coin purchases and memberships are fully simulated for this prototype — no payment method is ever charged.',
  },
  {
    q: 'How do I unlock a locked episode?',
    a: 'Open the episode and choose Unlock with coins, watch a simulated rewarded ad (where available), or join membership.',
  },
  {
    q: 'How do I reset my demo progress?',
    a: 'Go to Profile → Reset Prototype to clear all saved progress, unlocks, and coins on this device.',
  },
];

export default function HelpScreen() {
  return (
    <Screen>
      <StackHeader title="Help & Support" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          {BRAND.name} is a prototype build. This screen simulates a support center for demonstration purposes.
        </Text>
        {FAQS.map((item) => (
          <View key={item.q} style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="help-circle" size={16} color={colors.accent} />
              <Text style={styles.question}>{item.q}</Text>
            </View>
            <Text style={styles.answer}>{item.a}</Text>
          </View>
        ))}
        <View style={styles.contactCard}>
          <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.contactText}>{BRAND.supportEmail}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  intro: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  question: { ...typography.bodyMedium, color: colors.textPrimary, flex: 1 },
  answer: { ...typography.body, color: colors.textTertiary },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
  },
  contactText: { ...typography.body, color: colors.textSecondary },
});
