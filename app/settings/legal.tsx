import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { StackHeader } from '@/components/ui/StackHeader';
import { BRAND } from '@/config';

export default function LegalScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isPrivacy = type === 'privacy';

  return (
    <Screen>
      <StackHeader title={isPrivacy ? 'Privacy Policy' : 'Terms of Service'} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.notice}>Prototype placeholder document — not a legally binding agreement.</Text>
        <Text style={styles.paragraph}>
          {isPrivacy
            ? `This is a design prototype for ${BRAND.name}. No real user data is collected, stored, or transmitted to any server. All account details, viewing history, and purchases shown in this app live only in local device storage and are cleared whenever you reset the prototype.`
            : `This is a design prototype for ${BRAND.name}, built to demonstrate product design and user experience only. There are no real subscriptions, purchases, or accounts. All coins, memberships, and unlocks are simulated for demonstration purposes and carry no monetary value.`}
        </Text>
        <Text style={styles.heading}>{isPrivacy ? 'Data Collection' : 'No Real Transactions'}</Text>
        <Text style={styles.paragraph}>
          {isPrivacy
            ? 'Because this build has no backend, there is nothing to collect: sign-in, coin purchases, and subscriptions are all simulated locally on this device.'
            : 'Every "purchase" in this prototype is simulated. No payment method is ever charged, and no advertisement network is contacted.'}
        </Text>
        <Text style={styles.heading}>Contact</Text>
        <Text style={styles.paragraph}>For questions about this prototype, reach the product team at the address listed in Help & Support.</Text>
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
