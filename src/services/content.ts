import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { CastMember, Episode, EpisodeAccessType, Genre, Series, SeriesStatus } from '@/types';

interface SeriesRow {
  id: string;
  title: string;
  synopsis: string;
  genres: string[];
  rating: number;
  status: string;
  language: string;
  poster_color_from: string;
  poster_color_to: string;
  banner_color_from: string;
  banner_color_to: string;
  cast_members: CastMember[];
  popularity: number;
  is_new: boolean;
  poster_image_uri: string | null;
}

interface EpisodeRow {
  id: string;
  series_id: string;
  number: number;
  title: string;
  duration_sec: number;
  access: string;
  coin_price: number | null;
  published: boolean;
}

/** Episode columns the app reads. Videos are never selected: playback goes through playback-token. */
const EPISODE_COLUMNS = 'id, series_id, number, title, duration_sec, access, coin_price, published';

function mapSeries(row: SeriesRow): Series {
  return {
    id: row.id,
    title: row.title,
    synopsis: row.synopsis,
    genres: row.genres as Series['genres'],
    rating: row.rating,
    status: row.status as Series['status'],
    language: row.language as Series['language'],
    posterColorFrom: row.poster_color_from,
    posterColorTo: row.poster_color_to,
    bannerColorFrom: row.banner_color_from,
    bannerColorTo: row.banner_color_to,
    cast: row.cast_members,
    popularity: row.popularity,
    isNew: row.is_new,
    posterImageUri: row.poster_image_uri ?? undefined,
  };
}

function mapEpisode(row: EpisodeRow): Episode {
  return {
    id: row.id,
    seriesId: row.series_id,
    number: row.number,
    title: row.title,
    durationSec: row.duration_sec,
    access: row.access as Episode['access'],
    coinPrice: row.coin_price ?? undefined,
    published: row.published,
  };
}

async function fetchSeries(): Promise<Series[]> {
  const { data, error } = await supabase.from('series').select('*');
  if (error) throw error;
  return (data as SeriesRow[]).map(mapSeries);
}

async function fetchEpisodes(): Promise<Episode[]> {
  const { data, error } = await supabase.from('episodes').select(EPISODE_COLUMNS).order('number', { ascending: true });
  if (error) throw error;
  return (data as EpisodeRow[]).map(mapEpisode);
}

/** All series in the catalog. Tiny dataset — fetched once and cached. */
export function useSeries() {
  return useQuery({ queryKey: ['series'], queryFn: fetchSeries });
}

/** All episodes across every series. Filtered client-side where needed. */
export function useEpisodes() {
  return useQuery({ queryKey: ['episodes'], queryFn: fetchEpisodes });
}

export function useSeriesById(id: string | undefined) {
  const { data: series, ...rest } = useSeries();
  const item = useMemo(() => (id ? series?.find((s) => s.id === id) : undefined), [series, id]);
  return { data: item, ...rest };
}

export function useEpisodesForSeries(seriesId: string | undefined) {
  const { data: episodes, ...rest } = useEpisodes();
  const list = useMemo(
    () => (seriesId ? (episodes ?? []).filter((e) => e.seriesId === seriesId).sort((a, b) => a.number - b.number) : []),
    [episodes, seriesId]
  );
  return { data: list, ...rest };
}

export function useEpisodeById(id: string | undefined) {
  const { data: episodes, ...rest } = useEpisodes();
  const item = useMemo(() => (id ? episodes?.find((e) => e.id === id) : undefined), [episodes, id]);
  return { data: item, ...rest };
}

// --- Admin mutations -------------------------------------------------------
// Writes are RLS-gated on profiles.is_admin (see DramaRush-Backend migration
// 20260803000002_admin_role.sql) — these calls fail under RLS for non-admins,
// the same as any other supabase-js call, so no extra client-side check is
// needed here beyond the route guard in app/admin/_layout.tsx.

export interface SeriesInput {
  id: string;
  title: string;
  synopsis: string;
  genres: Genre[];
  rating: number;
  status: SeriesStatus;
  language: Series['language'];
  posterColorFrom: string;
  posterColorTo: string;
  bannerColorFrom: string;
  bannerColorTo: string;
  cast: CastMember[];
  popularity: number;
  isNew: boolean;
  posterImageUri?: string;
}

function toSeriesRow(input: SeriesInput) {
  return {
    id: input.id,
    title: input.title,
    synopsis: input.synopsis,
    genres: input.genres,
    rating: input.rating,
    status: input.status,
    language: input.language,
    poster_color_from: input.posterColorFrom,
    poster_color_to: input.posterColorTo,
    banner_color_from: input.bannerColorFrom,
    banner_color_to: input.bannerColorTo,
    cast_members: input.cast,
    popularity: input.popularity,
    is_new: input.isNew,
    poster_image_uri: input.posterImageUri ?? null,
  };
}

/** Uploads an image file to the public series-posters bucket and returns its public URL. */
export async function uploadSeriesPoster(file: File, seriesId: string): Promise<string> {
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '.jpg';
  const path = `${seriesId}${ext}`;
  const { error } = await supabase.storage.from('series-posters').upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('series-posters').getPublicUrl(path);
  return data.publicUrl;
}

export function useCreateSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SeriesInput) => {
      const { error } = await supabase.from('series').insert(toSeriesRow(input));
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['series'] }),
  });
}

export function useUpdateSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SeriesInput) => {
      const { id, ...rest } = toSeriesRow(input);
      const { error } = await supabase.from('series').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['series'] }),
  });
}

export function useDeleteSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('series').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
    },
  });
}

export interface EpisodeInput {
  id: string;
  seriesId: string;
  number: number;
  title: string;
  durationSec: number;
  access: EpisodeAccessType;
  coinPrice?: number;
  published: boolean;
}

function toEpisodeRow(input: EpisodeInput) {
  return {
    id: input.id,
    series_id: input.seriesId,
    number: input.number,
    title: input.title,
    duration_sec: input.durationSec,
    access: input.access,
    coin_price: input.access === 'coin' ? (input.coinPrice ?? null) : null,
    published: input.published,
  };
}

export function useCreateEpisode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EpisodeInput) => {
      const { error } = await supabase.from('episodes').insert(toEpisodeRow(input));
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['episodes'] }),
  });
}

export function useUpdateEpisode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EpisodeInput) => {
      const { id, ...rest } = toEpisodeRow(input);
      const { error } = await supabase.from('episodes').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['episodes'] }),
  });
}

export function useDeleteEpisode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Remove the episode's videos from Cloudflare first — deleting only the
      // row would leave them stored (and billed) with nothing pointing at them.
      const { data: removed, error: videoError } = await supabase.functions.invoke('admin-video-delete', {
        body: { episode_id: id },
      });
      if (videoError) throw await functionError(videoError);
      if (removed?.failed?.length) throw new Error('Could not delete the episode video from Cloudflare. Try again.');
      const { error } = await supabase.from('episodes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['episodes'] }),
  });
}

async function functionError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    return new Error(body?.error ?? `HTTP ${error.context.status}`);
  }
  return error instanceof Error ? error : new Error('Network error');
}

/** Cloudflare's single-request upload limit; bigger files go through `npm run upload-series` (backend). */
const MAX_IN_APP_UPLOAD_BYTES = 200 * 1024 * 1024;

/**
 * Uploads an episode's video to Cloudflare Stream (admins only). The episode
 * row must already exist. The backend issues a one-time upload URL; the file
 * goes straight to Cloudflare, which processes it and tells the backend when
 * it's ready (usually within a minute). A new video replaces the old one once
 * it's ready.
 */
export async function uploadEpisodeVideo(file: File, episodeId: string): Promise<void> {
  if (file.size > MAX_IN_APP_UPLOAD_BYTES) {
    throw new Error('Videos over 200 MB must be uploaded by the backend team (npm run upload-series).');
  }
  const { data, error } = await supabase.functions.invoke('admin-video-upload', {
    body: { episode_id: episodeId, file_size: file.size, file_name: file.name },
  });
  if (error) throw await functionError(error);

  const form = new FormData();
  form.append('file', file);
  const res = await fetch(data.upload_url, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Cloudflare rejected the upload (HTTP ${res.status}).`);
}

export interface EpisodeVideoStatus {
  status: 'pending_upload' | 'processing' | 'ready' | 'error';
  durationSec: number | null;
  errorReason: string | null;
}

/** Latest video of an episode, for the admin screens (video_assets is admin-readable only). */
export function useEpisodeVideoStatus(episodeId: string | undefined) {
  return useQuery({
    queryKey: ['episode-video', episodeId],
    enabled: !!episodeId,
    refetchInterval: (query) => {
      const status = (query.state.data as EpisodeVideoStatus | null)?.status;
      return status === 'pending_upload' || status === 'processing' ? 5000 : false;
    },
    queryFn: async (): Promise<EpisodeVideoStatus | null> => {
      const { data, error } = await supabase
        .from('video_assets')
        .select('status, duration_sec, error_reason')
        .eq('episode_id', episodeId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? { status: data.status, durationSec: data.duration_sec, errorReason: data.error_reason } : null;
    },
  });
}
