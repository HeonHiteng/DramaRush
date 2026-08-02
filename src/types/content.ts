export type Genre =
  | 'Romance'
  | 'Suspense'
  | 'Revenge'
  | 'Comedy'
  | 'Fantasy'
  | 'Youth'
  | 'Mystery'
  | 'Workplace';

export type SeriesStatus = 'ongoing' | 'completed';

export type EpisodeAccessType = 'free' | 'coin' | 'subscriber' | 'ad_unlock';

export interface Episode {
  id: string;
  seriesId: string;
  number: number;
  title: string;
  durationSec: number;
  videoUri: string;
  access: EpisodeAccessType;
  coinPrice?: number;
}

export interface CastMember {
  name: string;
  role: string;
}

export interface Series {
  id: string;
  title: string;
  synopsis: string;
  genres: Genre[];
  rating: number;
  status: SeriesStatus;
  language: 'English' | 'Spanish' | 'Korean' | 'Portuguese';
  posterColorFrom: string;
  posterColorTo: string;
  bannerColorFrom: string;
  bannerColorTo: string;
  cast: CastMember[];
  popularity: number;
  isNew: boolean;
}
