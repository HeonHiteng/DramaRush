import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  // One answer open at a time; the first starts open so the page isn't
  // just a list of questions.
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <Screen>
      <StackHeader title={t('profile.helpSupport')} fallback="/(tabs)/profile" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>{t('help.intro', { brand: BRAND.name })}</Text>
        <View style={styles.group}>
          {FAQ_KEYS.map((item, i) => {
            const open = openIndex === i;
            return (
              <View key={item.q} style={i > 0 && styles.itemBorder}>
                <Pressable
                  onPress={() => setOpenIndex(open ? null : i)}
                  style={styles.questionRow}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                >
                  <Text style={styles.question}>{t(item.q)}</Text>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
                </Pressable>
                {open && <Text style={styles.answer}>{t(item.a)}</Text>}
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>{t('help.contactHeading')}</Text>
        <Pressable
          onPress={() => Linking.openURL(`mailto:${BRAND.supportEmail}`)}
          style={({ pressed }) => [styles.contactCard, pressed && styles.pressed]}
          accessibilityRole="link"
          accessibilityLabel={`${t('help.emailUs')}: ${BRAND.supportEmail}`}
        >
          <View style={styles.contactIcon}>
            <Ionicons name="mail" size={18} color={colors.accent} />
          </View>
          <View style={styles.contactTextWrap}>
            <Text style={styles.contactTitle}>{t('help.emailUs')}</Text>
            <Text style={styles.contactText} numberOfLines={1}>
              {BRAND.supportEmail}
            </Text>
          </View>
          <Ionicons name="open-outline" size={16} color={colors.textTertiary} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  intro: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  itemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong },
  questionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  question: { ...typography.bodyMedium, color: colors.textPrimary, flex: 1 },
  answer: { ...typography.body, color: colors.textTertiary, paddingBottom: spacing.md, lineHeight: 21 },
  sectionLabel: {
    ...typography.micro,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactTextWrap: { flex: 1, minWidth: 0 },
  contactTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  contactText: { ...typography.caption, color: colors.textTertiary, marginTop: 1 },
});
