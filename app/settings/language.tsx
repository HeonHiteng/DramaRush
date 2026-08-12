import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { StackHeader } from '@/components/ui/StackHeader';
import { useSettingsStore } from '@/store';
import { LANGUAGES } from '@/i18n/translations';
import { useTranslation } from '@/i18n/useTranslation';

export default function LanguageSettingsScreen() {
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const { t } = useTranslation();

  return (
    <Screen>
      <StackHeader title={t('language.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.group}>
          {LANGUAGES.map((lang, i) => (
            <Pressable
              key={lang.code}
              onPress={() => setLanguage(lang.code)}
              style={[styles.row, i < LANGUAGES.length - 1 && styles.rowBorder]}
              accessibilityRole="button"
              accessibilityState={{ selected: language === lang.code }}
            >
              <Text style={styles.rowText}>{lang.label}</Text>
              {language === lang.code && <Ionicons name="checkmark" size={18} color={colors.accent} />}
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>{t('language.hint')}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { ...typography.body, color: colors.textPrimary },
  hint: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.md },
});
