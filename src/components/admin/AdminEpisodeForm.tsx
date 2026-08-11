import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { AppButton } from '@/components/ui/AppButton';
import { GenreChip } from '@/components/ui/GenreChip';
import { VideoFilePicker } from './VideoFilePicker';
import { uploadEpisodeVideo } from '@/services/content';
import type { EpisodeInput } from '@/services/content';
import { EPISODE_ACCESS_TYPES } from '@/data/adminPresets';
import type { Episode, EpisodeAccessType } from '@/types';

interface AdminEpisodeFormProps {
  seriesId: string;
  initial?: Episode;
  defaultNumber?: number;
  onSubmit: (input: EpisodeInput) => Promise<void>;
  submitLabel: string;
}

export function AdminEpisodeForm({ seriesId, initial, defaultNumber, onSubmit, submitLabel }: AdminEpisodeFormProps) {
  const [number, setNumber] = useState(initial ? String(initial.number) : String(defaultNumber ?? 1));
  const [title, setTitle] = useState(initial?.title ?? '');
  const [durationMin, setDurationMin] = useState(initial ? String(Math.round(initial.durationSec / 60)) : '10');
  const [access, setAccess] = useState<EpisodeAccessType>(initial?.access ?? 'free');
  const [coinPrice, setCoinPrice] = useState(initial?.coinPrice ? String(initial.coinPrice) : '20');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    const numberValue = Number(number);
    const durationSec = Number(durationMin) * 60;
    if (!title.trim()) return setError('Title is required.');
    if (!Number.isInteger(numberValue) || numberValue < 1) return setError('Episode number must be a positive whole number.');
    if (Number.isNaN(durationSec) || durationSec <= 0) return setError('Duration must be a positive number of minutes.');
    if (access === 'coin' && (!coinPrice || Number(coinPrice) <= 0)) return setError('Coin price is required for coin-unlock episodes.');
    if (!initial && !videoFile) return setError('Choose a video file.');

    let videoUri = initial?.videoUri ?? '';
    try {
      if (videoFile) {
        setUploading(true);
        videoUri = await uploadEpisodeVideo(videoFile, seriesId, numberValue);
        setUploading(false);
      }
    } catch (err) {
      setUploading(false);
      setError(err instanceof Error ? `Upload failed: ${err.message}` : 'Upload failed.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        id: initial?.id ?? `${seriesId}-ep${numberValue}`,
        seriesId,
        number: numberValue,
        title: title.trim(),
        durationSec,
        videoUri,
        access,
        coinPrice: access === 'coin' ? Number(coinPrice) : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong saving this episode.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.row}>
        <Field label="Episode #" style={styles.small}>
          <TextInput style={styles.input} value={number} onChangeText={setNumber} keyboardType="number-pad" />
        </Field>
        <Field label="Duration (minutes)" style={styles.small}>
          <TextInput style={styles.input} value={durationMin} onChangeText={setDurationMin} keyboardType="number-pad" />
        </Field>
      </View>

      <Field label="Title">
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Episode title" placeholderTextColor={colors.textTertiary} />
      </Field>

      <Field label="Access">
        <View style={styles.chipRow}>
          {EPISODE_ACCESS_TYPES.map((t) => (
            <GenreChip key={t.value} label={t.label} selected={access === t.value} onPress={() => setAccess(t.value)} />
          ))}
        </View>
      </Field>

      {access === 'coin' && (
        <Field label="Coin price">
          <TextInput style={styles.input} value={coinPrice} onChangeText={setCoinPrice} keyboardType="number-pad" />
        </Field>
      )}

      <Field label="Video file">
        <VideoFilePicker onFileSelected={setVideoFile} currentVideoUri={initial?.videoUri} />
      </Field>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <AppButton
        label={uploading ? 'Uploading video…' : submitLabel}
        onPress={handleSubmit}
        loading={uploading || submitting}
        fullWidth
      />
    </ScrollView>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  field: { gap: spacing.xs },
  fieldLabel: { ...typography.caption, color: colors.textTertiary, textTransform: 'uppercase' },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  small: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  errorText: { ...typography.caption, color: colors.danger },
});
