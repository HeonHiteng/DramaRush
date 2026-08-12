import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors, spacing, typography } from '@/theme';
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
      <StackHeader title={isPrivacy ? t('profile.privacyPolicy') : t('profile.termsOfService')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.notice}>{t('legal.prototypeNotice')}</Text>
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
    ...typography.caption,
    color: colors.gold,
    marginBottom: spacing.lg,
  },
  heading: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.xs },
  paragraph: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
});
