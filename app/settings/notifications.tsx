import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { StackHeader } from '@/components/ui/StackHeader';
import { MenuGroup, ProfileMenuItem } from '@/components/ui/ProfileMenuItem';
import { useSettingsStore } from '@/store';
import { useTranslation } from '@/i18n/useTranslation';

export default function NotificationsScreen() {
  const s = useSettingsStore();
  const { t } = useTranslation();

  return (
    <Screen>
      <StackHeader title={t('profile.notificationSettings')} fallback="/(tabs)/profile" />
      <ScrollView contentContainerStyle={styles.content}>
        <MenuGroup>
          <ProfileMenuItem
            icon="notifications-outline"
            label={t('settings.pushNotifications')}
            toggle={{ value: s.notificationsEnabled, onChange: s.setNotificationsEnabled }}
          />
        </MenuGroup>
        <Text style={styles.hint}>{t('settings.notificationsHint')}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  hint: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.sm, marginHorizontal: spacing.xs },
});
