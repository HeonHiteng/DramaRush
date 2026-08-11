import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
}

interface EpisodeRow {
  id: string;
  series_id: string;
  number: number;
  title: string;
  duration_sec: number;
  video_uri: string;
  access: string;
  coin_price: number | null;
}

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
  };
}

function mapEpisode(row: EpisodeRow): Episode {
  return {
    id: row.id,
    seriesId: row.series_id,
    number: row.number,
    title: row.title,
    durationSec: row.duration_sec,
    videoUri: row.video_uri,
    access: row.access as Episode['access'],
    coinPrice: row.coin_price ?? undefined,
  };
}

async function fetchSeries(): Promise<Series[]> {
  const { data, error } = await supabase.from('series').select('*');
  if (error) throw error;
  return (data as SeriesRow[]).map(mapSeries);
}

async function fetchEpisodes(): Promise<Episode[]> {
  const { data, error } = await supabase.from('episodes').select('*').order('number', { ascending: true });
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
  };
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
  videoUri: string;
  access: EpisodeAccessType;
  coinPrice?: number;
}

function toEpisodeRow(input: EpisodeInput) {
  return {
    id: input.id,
    series_id: input.seriesId,
    number: input.number,
    title: input.title,
    duration_sec: input.durationSec,
    video_uri: input.videoUri,
    access: input.access,
    coin_price: input.access === 'coin' ? (input.coinPrice ?? null) : null,
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
      const { error } = await supabase.from('episodes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['episodes'] }),
  });
}

/** Uploads a video file to the public episode-videos bucket and returns its public URL. */
export async function uploadEpisodeVideo(file: File, seriesId: string, episodeNumber: number): Promise<string> {
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '.mp4';
  const path = `${seriesId}/ep${episodeNumber}${ext}`;
  const { error } = await supabase.storage.from('episode-videos').upload(path, file, {
    contentType: file.type || 'video/mp4',
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('episode-videos').getPublicUrl(path);
  return data.publicUrl;
}
