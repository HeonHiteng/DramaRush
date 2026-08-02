import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { StackHeader } from '@/components/ui/StackHeader';
import { ProfileMenuItem } from '@/components/ui/ProfileMenuItem';
import { useSettingsStore } from '@/store';

export default function NotificationsScreen() {
  const s = useSettingsStore();

  return (
    <Screen>
      <StackHeader title="Notification Settings" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.group}>
          <ProfileMenuItem
            icon="notifications-outline"
            label="Push Notifications"
            toggle={{ value: s.notificationsEnabled, onChange: s.setNotificationsEnabled }}
          />
        </View>
        <Text style={styles.hint}>
          In this prototype, notifications are never actually sent — this toggle only demonstrates the settings UI.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  hint: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.md },
});
