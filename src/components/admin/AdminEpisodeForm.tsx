import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { AppButton } from '@/components/ui/AppButton';
import { GenreChip } from '@/components/ui/GenreChip';
import { FilePicker } from './FilePicker';
import { uploadEpisodeVideo, useEpisodeVideoStatus } from '@/services/content';
import type { EpisodeInput } from '@/services/content';
import { EPISODE_ACCESS_TYPES } from '@/data/adminPresets';
import type { Episode, EpisodeAccessType } from '@/types';

interface AdminEpisodeFormProps {
  seriesId: string;
  initial?: Episode;
  defaultNumber?: number;
  /** Saves the episode row; throw to show an error in the form. */
  onSubmit: (input: EpisodeInput) => Promise<void>;
  /** Called after the episode is saved and any chosen video has been handed to Cloudflare. */
  onDone: () => void;
  submitLabel: string;
}

export function AdminEpisodeForm({ seriesId, initial, defaultNumber, onSubmit, onDone, submitLabel }: AdminEpisodeFormProps) {
  const [number, setNumber] = useState(initial ? String(initial.number) : String(defaultNumber ?? 1));
  const [title, setTitle] = useState(initial?.title ?? '');
  const [durationMin, setDurationMin] = useState(initial ? String(Math.round(initial.durationSec / 60)) : '10');
  const [access, setAccess] = useState<EpisodeAccessType>(initial?.access ?? 'free');
  const [coinPrice, setCoinPrice] = useState(initial?.coinPrice ? String(initial.coinPrice) : '20');
  const [published, setPublished] = useState(initial?.published ?? false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const { data: videoStatus, refetch: refetchVideoStatus } = useEpisodeVideoStatus(initial?.id);
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

    const episodeId = initial?.id ?? `${seriesId}-ep${numberValue}`;

    // Save the episode first: the video upload is attached to an existing episode.
    setSubmitting(true);
    try {
      await onSubmit({
        id: episodeId,
        seriesId,
        number: numberValue,
        title: title.trim(),
        durationSec,
        access,
        coinPrice: access === 'coin' ? Number(coinPrice) : undefined,
        published,
      });
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : 'Something went wrong saving this episode.');
      return;
    }
    setSubmitting(false);

    if (videoFile) {
      setUploading(true);
      try {
        await uploadEpisodeVideo(videoFile, episodeId);
        setVideoFile(null);
        refetchVideoStatus();
      } catch (err) {
        setUploading(false);
        setError(err instanceof Error ? `Episode saved, but the video upload failed: ${err.message}` : 'Video upload failed.');
        return;
      }
      setUploading(false);
    }
    onDone();
  };

  const videoStatusText = videoStatus
    ? videoStatus.status === 'ready'
      ? `ready${videoStatus.durationSec ? ` (${Math.round(videoStatus.durationSec)}s)` : ''}`
      : videoStatus.status === 'error'
        ? `failed — ${videoStatus.errorReason ?? 'unknown error'}`
        : 'processing on Cloudflare…'
    : undefined;

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

      <Field label="Visibility">
        <View style={styles.chipRow}>
          <GenreChip label="Draft" selected={!published} onPress={() => setPublished(false)} />
          <GenreChip label="Published" selected={published} onPress={() => setPublished(true)} />
        </View>
      </Field>

      <Field label="Video file">
        <FilePicker
          accept="video/*"
          label="Choose a video file"
          replaceLabel="Replace video file"
          onFileSelected={setVideoFile}
          currentFileUri={videoStatusText}
        />
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
