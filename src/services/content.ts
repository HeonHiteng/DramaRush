import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CastMember, Episode, Series } from '@/types';

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
