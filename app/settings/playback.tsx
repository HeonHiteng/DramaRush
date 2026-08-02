import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { StackHeader } from '@/components/ui/StackHeader';
import { ProfileMenuItem } from '@/components/ui/ProfileMenuItem';
import { useSettingsStore, type PlaybackQuality } from '@/store/settingsStore';

const QUALITIES: PlaybackQuality[] = ['auto', '480p', '720p', '1080p'];

export default function PlaybackSettingsScreen() {
  const s = useSettingsStore();

  return (
    <Screen>
      <StackHeader title="Playback Settings" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.group}>
          <ProfileMenuItem
            icon="play-skip-forward-outline"
            label="Autoplay Next Episode"
            toggle={{ value: s.autoplayNextEpisode, onChange: s.setAutoplayNextEpisode }}
          />
          <ProfileMenuItem
            icon="chatbox-ellipses-outline"
            label="Subtitles by Default"
            toggle={{ value: s.subtitlesEnabled, onChange: s.setSubtitlesEnabled }}
          />
          <ProfileMenuItem
            icon="accessibility-outline"
            label="Reduce Motion"
            toggle={{ value: s.reducedMotion, onChange: s.setReducedMotion }}
          />
        </View>

        <Text style={styles.sectionLabel}>Streaming Quality</Text>
        <View style={styles.qualityRow}>
          {QUALITIES.map((q) => (
            <Pressable
              key={q}
              onPress={() => s.setPlaybackQuality(q)}
              style={[styles.qualityChip, s.playbackQuality === q && styles.qualityChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: s.playbackQuality === q }}
            >
              <Text style={[styles.qualityText, s.playbackQuality === q && styles.qualityTextActive]}>
                {q === 'auto' ? 'Auto' : q}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xl },
  sectionLabel: { ...typography.caption, color: colors.textTertiary, marginBottom: spacing.sm },
  qualityRow: { flexDirection: 'row', gap: spacing.xs },
  qualityChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qualityChipActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  qualityText: { ...typography.bodyMedium, color: colors.textSecondary },
  qualityTextActive: { color: colors.accent },
});
