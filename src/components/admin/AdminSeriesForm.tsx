import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, typography } from '@/theme';
import { AppButton } from '@/components/ui/AppButton';
import { GenreChip } from '@/components/ui/GenreChip';
import { GENRES } from '@/data/genres';
import { GRADIENT_PRESETS, LANGUAGES, SERIES_STATUSES } from '@/data/adminPresets';
import { FilePicker } from './FilePicker';
import { uploadSeriesPoster } from '@/services/content';
import type { SeriesInput } from '@/services/content';
import type { CastMember, Genre, Series } from '@/types';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface AdminSeriesFormProps {
  initial?: Series;
  onSubmit: (input: SeriesInput) => Promise<void>;
  submitting: boolean;
  submitLabel: string;
}

export function AdminSeriesForm({ initial, onSubmit, submitting, submitLabel }: AdminSeriesFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [synopsis, setSynopsis] = useState(initial?.synopsis ?? '');
  const [genres, setGenres] = useState<Genre[]>(initial?.genres ?? []);
  const [rating, setRating] = useState(initial ? String(initial.rating) : '4.5');
  const [status, setStatus] = useState<Series['status']>(initial?.status ?? 'ongoing');
  const [language, setLanguage] = useState<Series['language']>(initial?.language ?? 'English');
  const [isNew, setIsNew] = useState(initial?.isNew ?? true);
  const [popularity, setPopularity] = useState(initial ? String(initial.popularity) : '50');
  const [cast, setCast] = useState<CastMember[]>(initial?.cast ?? [{ name: '', role: '' }]);
  const [presetIndex, setPresetIndex] = useState(() => {
    if (!initial) return 0;
    const match = GRADIENT_PRESETS.findIndex((p) => p.posterColorFrom === initial.posterColorFrom);
    return match >= 0 ? match : 0;
  });
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPoster, setUploadingPoster] = useState(false);

  const toggleGenre = (g: Genre) => {
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const updateCastRow = (index: number, field: keyof CastMember, value: string) => {
    setCast((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const handleSubmit = async () => {
    setError(null);
    const ratingNum = Number(rating);
    const popularityNum = Number(popularity);
    if (!title.trim()) return setError('Title is required.');
    if (!synopsis.trim()) return setError('Synopsis is required.');
    if (genres.length === 0) return setError('Pick at least one genre.');
    if (Number.isNaN(ratingNum) || ratingNum < 0 || ratingNum > 5) return setError('Rating must be a number between 0 and 5.');
    if (Number.isNaN(popularityNum) || popularityNum < 0) return setError('Popularity must be a positive number.');

    const preset = GRADIENT_PRESETS[presetIndex];
    const cleanedCast = cast.filter((c) => c.name.trim() && c.role.trim());
    const id = initial?.id ?? slugify(title);

    let posterImageUri = initial?.posterImageUri;
    if (posterFile) {
      try {
        setUploadingPoster(true);
        posterImageUri = await uploadSeriesPoster(posterFile, id);
      } catch (err) {
        setUploadingPoster(false);
        setError(err instanceof Error ? `Poster upload failed: ${err.message}` : 'Poster upload failed.');
        return;
      }
      setUploadingPoster(false);
    }

    await onSubmit({
      id,
      title: title.trim(),
      synopsis: synopsis.trim(),
      genres,
      rating: ratingNum,
      status,
      language,
      posterColorFrom: preset.posterColorFrom,
      posterColorTo: preset.posterColorTo,
      bannerColorFrom: preset.bannerColorFrom,
      bannerColorTo: preset.bannerColorTo,
      cast: cleanedCast,
      popularity: popularityNum,
      isNew,
      posterImageUri,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Field label="Title">
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Series title" placeholderTextColor={colors.textTertiary} />
      </Field>
      {!initial && title.trim().length > 0 && <Text style={styles.hint}>ID: {slugify(title)}</Text>}

      <Field label="Synopsis">
        <TextInput
          style={[styles.input, styles.multiline]}
          value={synopsis}
          onChangeText={setSynopsis}
          placeholder="One or two sentences describing the series"
          placeholderTextColor={colors.textTertiary}
          multiline
        />
      </Field>

      <Field label="Genres">
        <View style={styles.chipRow}>
          {GENRES.map((g) => (
            <GenreChip key={g} label={g} selected={genres.includes(g)} onPress={() => toggleGenre(g)} />
          ))}
        </View>
      </Field>

      <Field label="Poster image (optional)">
        <FilePicker
          accept="image/*"
          label="Choose a poster image"
          replaceLabel="Replace poster image"
          onFileSelected={setPosterFile}
          currentFileUri={initial?.posterImageUri}
        />
        <Text style={styles.hint}>Falls back to the color theme + icon below when no image is set.</Text>
      </Field>

      <Field label="Color theme">
        <View style={styles.chipRow}>
          {GRADIENT_PRESETS.map((preset, i) => (
            <Pressable key={preset.name} onPress={() => setPresetIndex(i)} accessibilityRole="button" accessibilityLabel={preset.name}>
              <LinearGradient
                colors={[preset.posterColorFrom, preset.posterColorTo]}
                style={[styles.swatch, presetIndex === i && styles.swatchSelected]}
              >
                {presetIndex === i && <Ionicons name="checkmark" size={18} color={colors.white} />}
              </LinearGradient>
            </Pressable>
          ))}
        </View>
      </Field>

      <View style={styles.row}>
        <Field label="Rating (0–5)" style={styles.half}>
          <TextInput style={styles.input} value={rating} onChangeText={setRating} keyboardType="decimal-pad" />
        </Field>
        <Field label="Popularity" style={styles.half}>
          <TextInput style={styles.input} value={popularity} onChangeText={setPopularity} keyboardType="number-pad" />
        </Field>
      </View>

      <Field label="Status">
        <View style={styles.chipRow}>
          {SERIES_STATUSES.map((s) => (
            <GenreChip key={s} label={s === 'ongoing' ? 'Ongoing' : 'Completed'} selected={status === s} onPress={() => setStatus(s)} />
          ))}
        </View>
      </Field>

      <Field label="Language">
        <View style={styles.chipRow}>
          {LANGUAGES.map((l) => (
            <GenreChip key={l} label={l} selected={language === l} onPress={() => setLanguage(l)} />
          ))}
        </View>
      </Field>

      <Field label="Mark as New">
        <View style={styles.chipRow}>
          <GenreChip label="Yes" selected={isNew} onPress={() => setIsNew(true)} />
          <GenreChip label="No" selected={!isNew} onPress={() => setIsNew(false)} />
        </View>
      </Field>

      <Field label="Cast">
        {cast.map((c, i) => (
          <View key={i} style={styles.castRow}>
            <TextInput
              style={[styles.input, styles.castInput]}
              value={c.name}
              onChangeText={(v) => updateCastRow(i, 'name', v)}
              placeholder="Actor name"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={[styles.input, styles.castInput]}
              value={c.role}
              onChangeText={(v) => updateCastRow(i, 'role', v)}
              placeholder="Character name"
              placeholderTextColor={colors.textTertiary}
            />
            <Pressable onPress={() => setCast((prev) => prev.filter((_, idx) => idx !== i))} hitSlop={8} style={styles.removeButton}>
              <Ionicons name="close-circle" size={22} color={colors.textTertiary} />
            </Pressable>
          </View>
        ))}
        <AppButton
          label="Add cast member"
          variant="ghost"
          onPress={() => setCast((prev) => [...prev, { name: '', role: '' }])}
          icon={<Ionicons name="add" size={16} color={colors.textSecondary} />}
        />
      </Field>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <AppButton
        label={uploadingPoster ? 'Uploading poster…' : submitLabel}
        onPress={handleSubmit}
        loading={submitting || uploadingPoster}
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
  hint: { ...typography.caption, color: colors.textTertiary, marginTop: -spacing.xs },
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
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: { borderColor: colors.accent },
  castRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  castInput: { flex: 1 },
  removeButton: { padding: spacing.xs },
  errorText: { ...typography.caption, color: colors.danger },
});
