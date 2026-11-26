import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { StackHeader } from '@/components/ui/StackHeader';
import { BRAND } from '@/config';
import { useTranslation } from '@/i18n/useTranslation';

export default function LegalScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isPrivacy = type === 'privacy';
  const { t } = useTranslation();

  return (
    <Screen>
      <StackHeader title={isPrivacy ? t('profile.privacyPolicy') : t('profile.termsOfService')} fallback="/(tabs)/profile" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.notice}>
          <Ionicons name="information-circle" size={18} color={colors.gold} />
          <Text style={styles.noticeText}>{t('legal.prototypeNotice')}</Text>
        </View>
        <Text style={styles.paragraph}>
          {t(isPrivacy ? 'legal.privacyBody' : 'legal.termsBody', { brand: BRAND.name })}
        </Text>
        <Text style={styles.heading}>{isPrivacy ? t('legal.dataCollectionHeading') : t('legal.noRealTransactionsHeading')}</Text>
        <Text style={styles.paragraph}>
          {t(isPrivacy ? 'legal.dataCollectionBody' : 'legal.noRealTransactionsBody')}
        </Text>
        <Text style={styles.heading}>{t('legal.contactHeading')}</Text>
        <Text style={styles.paragraph}>{t('legal.contactBody')}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.goldMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
  noticeText: { ...typography.caption, color: colors.gold, flex: 1, lineHeight: 18 },
  heading: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.xs },
  paragraph: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
});
