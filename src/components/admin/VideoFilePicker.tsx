import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';

interface VideoFilePickerProps {
  onFileSelected: (file: File) => void;
  currentVideoUri?: string;
}

/** Native fallback — the admin content tool is web-only for now; see VideoFilePicker.web.tsx. */
export function VideoFilePicker(_props: VideoFilePickerProps) {
  return (
    <View style={styles.dropZone}>
      <Ionicons name="desktop-outline" size={28} color={colors.textTertiary} />
      <Text style={styles.text}>Video upload is only available in the web admin panel right now.</Text>
      <Text style={styles.subtext}>Open this screen in a desktop browser to upload a file.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dropZone: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceRaised,
  },
  text: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  subtext: { ...typography.caption, color: colors.textTertiary, textAlign: 'center' },
});
