import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { StackHeader } from '@/components/ui/StackHeader';
import { BRAND } from '@/config';
import { useTranslation } from '@/i18n/useTranslation';
import type { TranslationKey } from '@/i18n/translations';

const FAQ_KEYS: { q: TranslationKey; a: TranslationKey }[] = [
  { q: 'help.faq1Q', a: 'help.faq1A' },
  { q: 'help.faq2Q', a: 'help.faq2A' },
  { q: 'help.faq3Q', a: 'help.faq3A' },
];

export default function HelpScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <StackHeader title={t('profile.helpSupport')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>{t('help.intro', { brand: BRAND.name })}</Text>
        {FAQ_KEYS.map((item) => (
          <View key={item.q} style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="help-circle" size={16} color={colors.accent} />
              <Text style={styles.question}>{t(item.q)}</Text>
            </View>
            <Text style={styles.answer}>{t(item.a)}</Text>
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
