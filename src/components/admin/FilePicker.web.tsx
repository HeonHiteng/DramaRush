import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';

interface FilePickerProps {
  accept: string;
  label: string;
  replaceLabel: string;
  onFileSelected: (file: File) => void;
  currentFileUri?: string;
}

/** Web-only file picker (uses a real DOM <input type="file">). See FilePicker.tsx for native. */
export function FilePicker({ accept, label, replaceLabel, onFileSelected, currentFileUri }: FilePickerProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      onFileSelected(file);
    }
  };

  return (
    <View>
      <Pressable onPress={() => inputRef.current?.click()} style={styles.dropZone} accessibilityRole="button" accessibilityLabel={label}>
        <Ionicons name="cloud-upload-outline" size={28} color={colors.textTertiary} />
        <Text style={styles.dropZoneText}>{fileName ?? (currentFileUri ? replaceLabel : label)}</Text>
        {!fileName && currentFileUri && (
          <Text style={styles.currentUri} numberOfLines={1}>
            Current: {currentFileUri}
          </Text>
        )}
      </Pressable>
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange} style={{ display: 'none' }} />
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceRaised,
  },
  dropZoneText: { ...typography.body, color: colors.textSecondary },
  currentUri: { ...typography.caption, color: colors.textTertiary, maxWidth: 280 },
});
