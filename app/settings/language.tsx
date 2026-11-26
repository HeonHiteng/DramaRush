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
      <StackHeader title={t('language.title')} fallback="/(tabs)/profile" />
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
              <Text style={[styles.rowText, language === lang.code && styles.rowTextActive]}>{lang.label}</Text>
              <Ionicons
                name={language === lang.code ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={language === lang.code ? colors.accent : colors.textDisabled}
              />
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
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  rowText: { ...typography.body, color: colors.textPrimary },
  rowTextActive: { ...typography.bodyMedium },
  hint: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.sm, marginHorizontal: spacing.xs },
});
