import type { CastMember, Episode, EpisodeAccessType, Series } from '@/types';
import { videoForIndex } from './videoSources';

interface EpisodeBlueprint {
  title: string;
  access: EpisodeAccessType;
  coinPrice?: number;
  durationSec: number;
}

interface SeriesBlueprint {
  id: string;
  title: string;
  synopsis: string;
  genres: Series['genres'];
  rating: number;
  status: Series['status'];
  language: Series['language'];
  posterColorFrom: string;
  posterColorTo: string;
  bannerColorFrom: string;
  bannerColorTo: string;
  cast: CastMember[];
  popularity: number;
  isNew: boolean;
  episodes: EpisodeBlueprint[];
}

let globalVideoIndex = 0;
function nextVideo(): string {
  return videoForIndex(globalVideoIndex++);
}

const blueprints: SeriesBlueprint[] = [
  {
    id: 'crimson-contract',
    title: 'Crimson Contract',
    synopsis:
      'Presumed dead after a car crash orchestrated by her fiancé\'s family, Wren Hale resurfaces under a new name — and a seat on the board of the company that tried to erase her.',
    genres: ['Revenge', 'Suspense'],
    rating: 4.8,
    status: 'ongoing',
    language: 'English',
    posterColorFrom: '#3A1420',
    posterColorTo: '#7A1F2B',
    bannerColorFrom: '#4A0F1A',
    bannerColorTo: '#8C2233',
    cast: [
      { name: 'Elena Marsh', role: 'Wren Hale' },
      { name: 'Damon Reyes', role: 'Julian Cross' },
      { name: 'Priya Anand', role: 'Detective Kim' },
    ],
    popularity: 98,
    isNew: false,
    episodes: [
      { title: 'The Crash That Wasn\'t', access: 'free', durationSec: 612 },
      { title: 'A Name Not My Own', access: 'free', durationSec: 588 },
      { title: 'Boardroom Ghost', access: 'ad_unlock', durationSec: 634 },
      { title: 'The First Domino', access: 'coin', coinPrice: 20, durationSec: 601 },
      { title: 'Old Enemies, New Faces', access: 'coin', coinPrice: 20, durationSec: 655 },
      { title: 'A Toast to Ruin', access: 'coin', coinPrice: 25, durationSec: 590 },
      { title: 'The Ledger Opens', access: 'subscriber', durationSec: 641 },
      { title: 'Checkmate in Heels', access: 'subscriber', durationSec: 677 },
    ],
  },
  {
    id: 'heir-to-nowhere',
    title: 'Heir to Nowhere',
    synopsis:
      'To prove he can earn it, the secret heir of Callahan Group clocks in as the newest intern — and falls hard for the assistant tasked with keeping the office running.',
    genres: ['Romance', 'Workplace'],
    rating: 4.6,
    status: 'ongoing',
    language: 'English',
    posterColorFrom: '#1B2033',
    posterColorTo: '#2E3A66',
    bannerColorFrom: '#141A2E',
    bannerColorTo: '#3A4A8C',
    cast: [
      { name: 'Noah Bright', role: 'Theo Callahan' },
      { name: 'Marisol Vega', role: 'Ines Duarte' },
      { name: 'Kenji Osei', role: 'Marcus Wren' },
    ],
    popularity: 91,
    isNew: true,
    episodes: [
      { title: 'Badge 214', access: 'free', durationSec: 560 },
      { title: 'Coffee Run', access: 'free', durationSec: 545 },
      { title: 'The Wrong Elevator', access: 'free', durationSec: 572 },
      { title: 'Overtime', access: 'ad_unlock', durationSec: 598 },
      { title: 'Company Retreat', access: 'coin', coinPrice: 15, durationSec: 610 },
      { title: 'Under His Signature', access: 'coin', coinPrice: 15, durationSec: 583 },
    ],
  },
  {
    id: 'midnight-ledger',
    title: 'Midnight Ledger',
    synopsis:
      'A forensic accountant finds her missing sister\'s handwriting in a set of falsified books — and every entry pulls her closer to the people who want the ledger burned.',
    genres: ['Mystery', 'Suspense'],
    rating: 4.7,
    status: 'ongoing',
    language: 'English',
    posterColorFrom: '#141A1C',
    posterColorTo: '#204045',
    bannerColorFrom: '#0F1517',
    bannerColorTo: '#2A5A61',
    cast: [
      { name: 'Sofia Lindqvist', role: 'Ada Reyes' },
      { name: 'Malik Fontaine', role: 'Detective Osei' },
      { name: 'Grace Tanaka', role: 'Ren Reyes (missing)' },
    ],
    popularity: 87,
    isNew: false,
    episodes: [
      { title: 'Row 47', access: 'free', durationSec: 605 },
      { title: 'Her Handwriting', access: 'free', durationSec: 590 },
      { title: 'The Numbers Lie', access: 'coin', coinPrice: 18, durationSec: 622 },
      { title: 'A Warning in Red Ink', access: 'coin', coinPrice: 18, durationSec: 599 },
      { title: 'Whoever Signs Last', access: 'ad_unlock', durationSec: 615 },
      { title: 'The Second Ledger', access: 'subscriber', durationSec: 648 },
      { title: 'Ren\'s Room', access: 'subscriber', durationSec: 660 },
    ],
  },
  {
    id: 'paper-moon-diner',
    title: 'Paper Moon Diner',
    synopsis:
      'Between burnt pancakes and a betting pool on who\'ll confess first, the graveyard-shift crew of a small-town diner turns every night shift into a small disaster.',
    genres: ['Comedy', 'Romance'],
    rating: 4.5,
    status: 'completed',
    language: 'English',
    posterColorFrom: '#2B1B10',
    posterColorTo: '#7A4A1E',
    bannerColorFrom: '#20140B',
    bannerColorTo: '#9C5E22',
    cast: [
      { name: 'Ruby Solano', role: 'Jo Alvarez' },
      { name: 'Tobin Reid', role: 'Cash Bennett' },
      { name: 'Amara Okafor', role: 'Deja Price' },
    ],
    popularity: 76,
    isNew: false,
    episodes: [
      { title: 'Order Up', access: 'free', durationSec: 520 },
      { title: 'The Betting Pool', access: 'free', durationSec: 505 },
      { title: 'Burnt Pancakes', access: 'free', durationSec: 512 },
      { title: 'Closing Shift', access: 'free', durationSec: 530 },
      { title: 'Jukebox Confession', access: 'ad_unlock', durationSec: 540 },
      { title: 'The Last Booth', access: 'coin', coinPrice: 12, durationSec: 555 },
    ],
  },
  {
    id: 'ever-after-glitch',
    title: 'Ever After Glitch',
    synopsis:
      'Pulled into a malfunctioning fairy-tale simulation, Iris has three in-game days to break the loop — before the story decides to write her out for good.',
    genres: ['Fantasy', 'Romance'],
    rating: 4.9,
    status: 'ongoing',
    language: 'English',
    posterColorFrom: '#1E1330',
    posterColorTo: '#5A2E8C',
    bannerColorFrom: '#160D26',
    bannerColorTo: '#7B3FB8',
    cast: [
      { name: 'Iris Okonkwo', role: 'Iris Vance' },
      { name: 'Felix Aro', role: 'Prince Corvin (NPC)' },
      { name: 'Nadia Petrov', role: 'The Narrator' },
    ],
    popularity: 95,
    isNew: true,
    episodes: [
      { title: 'Loading Happily Ever After', access: 'free', durationSec: 598 },
      { title: 'A Prince With a Bug', access: 'free', durationSec: 605 },
      { title: 'Save File Corrupted', access: 'coin', coinPrice: 20, durationSec: 611 },
      { title: 'The Narrator Notices', access: 'coin', coinPrice: 20, durationSec: 597 },
      { title: 'Glass Slipper, Cracked', access: 'ad_unlock', durationSec: 620 },
      { title: 'Rewriting the Ending', access: 'subscriber', durationSec: 635 },
      { title: 'Day Three', access: 'subscriber', durationSec: 642 },
      { title: 'Ever After, Actually', access: 'subscriber', durationSec: 650 },
    ],
  },
  {
    id: 'varsity-hearts',
    title: 'Varsity Hearts',
    synopsis:
      'Two rival campus idol groups are forced to co-produce the spring showcase — and discover harmony sounds a lot like falling for the competition.',
    genres: ['Youth', 'Romance'],
    rating: 4.4,
    status: 'ongoing',
    language: 'Korean',
    posterColorFrom: '#0F1E2B',
    posterColorTo: '#1C6E8C',
    bannerColorFrom: '#0B1620',
    bannerColorTo: '#2A8FB0',
    cast: [
      { name: 'Yuna Park', role: 'Seo-yeon' },
      { name: 'Jin Baek', role: 'Do-hyun' },
      { name: 'Mina Cho', role: 'Coach Yoon' },
    ],
    popularity: 83,
    isNew: true,
    episodes: [
      { title: 'Audition Chaos', access: 'free', durationSec: 540 },
      { title: 'Rival Practice Rooms', access: 'free', durationSec: 555 },
      { title: 'Shared Playlist', access: 'ad_unlock', durationSec: 560 },
      { title: 'Duet Assignment', access: 'coin', coinPrice: 15, durationSec: 572 },
      { title: 'Backstage Nerves', access: 'coin', coinPrice: 15, durationSec: 566 },
      { title: 'Encore', access: 'coin', coinPrice: 18, durationSec: 580 },
    ],
  },
  {
    id: 'understudys-revenge',
    title: 'The Understudy\'s Revenge',
    synopsis:
      'Fired and blacklisted on false claims, a rising producer rebuilds under an alias — and lands the one deal that can expose the boss who ended her career.',
    genres: ['Revenge', 'Workplace'],
    rating: 4.6,
    status: 'completed',
    language: 'English',
    posterColorFrom: '#241017',
    posterColorTo: '#5E1E2E',
    bannerColorFrom: '#1A0B10',
    bannerColorTo: '#7A2439',
    cast: [
      { name: 'Camille Dorsey', role: 'Nora Vance' },
      { name: 'Owen Marsh', role: 'Bradley Kane' },
      { name: 'Layla Haddad', role: 'Priya Suresh' },
    ],
    popularity: 88,
    isNew: false,
    episodes: [
      { title: 'The Termination Letter', access: 'free', durationSec: 600 },
      { title: 'A New Name Badge', access: 'free', durationSec: 590 },
      { title: 'The Pitch Meeting', access: 'coin', coinPrice: 18, durationSec: 610 },
      { title: 'Friends in Low Places', access: 'coin', coinPrice: 18, durationSec: 605 },
      { title: 'Paper Trail', access: 'ad_unlock', durationSec: 615 },
      { title: 'The Real Signature', access: 'coin', coinPrice: 22, durationSec: 620 },
      { title: 'Reinstated', access: 'coin', coinPrice: 22, durationSec: 630 },
    ],
  },
  {
    id: 'static-bloom',
    title: 'Static Bloom',
    synopsis:
      'Every Tuesday, a florist receives a bouquet addressed from herself — postmarked from a timeline where she made every choice differently.',
    genres: ['Mystery', 'Fantasy'],
    rating: 4.7,
    status: 'ongoing',
    language: 'Portuguese',
    posterColorFrom: '#101F16',
    posterColorTo: '#2E6B45',
    bannerColorFrom: '#0B1710',
    bannerColorTo: '#3E8C58',
    cast: [
      { name: 'Bianca Souza', role: 'Alma Ferreira' },
      { name: 'Rafael Nunes', role: 'Theo Duarte' },
      { name: 'Isadora Melo', role: 'Alma (Other Timeline)' },
    ],
    popularity: 79,
    isNew: false,
    episodes: [
      { title: 'The First Bouquet', access: 'free', durationSec: 570 },
      { title: 'A Return Address', access: 'free', durationSec: 585 },
      { title: 'The Other Alma', access: 'coin', coinPrice: 16, durationSec: 600 },
      { title: 'What She Didn\'t Choose', access: 'ad_unlock', durationSec: 595 },
      { title: 'Wilted Warning', access: 'coin', coinPrice: 16, durationSec: 610 },
      { title: 'Cross-Pollination', access: 'subscriber', durationSec: 625 },
    ],
  },
];

function buildEpisodes(seriesId: string, blueprint: EpisodeBlueprint[]): Episode[] {
  return blueprint.map((ep, index) => ({
    id: `${seriesId}-ep${index + 1}`,
    seriesId,
    number: index + 1,
    title: ep.title,
    durationSec: ep.durationSec,
    videoUri: nextVideo(),
    access: ep.access,
    coinPrice: ep.coinPrice,
  }));
}

export const EPISODES: Episode[] = blueprints.flatMap((b) => buildEpisodes(b.id, b.episodes));

export const SERIES: Series[] = blueprints.map((b) => ({
  id: b.id,
  title: b.title,
  synopsis: b.synopsis,
  genres: b.genres,
  rating: b.rating,
  status: b.status,
  language: b.language,
  posterColorFrom: b.posterColorFrom,
  posterColorTo: b.posterColorTo,
  bannerColorFrom: b.bannerColorFrom,
  bannerColorTo: b.bannerColorTo,
  cast: b.cast,
  popularity: b.popularity,
  isNew: b.isNew,
  episodeIds: EPISODES.filter((e) => e.seriesId === b.id).map((e) => e.id),
}));

export function getSeriesById(id: string): Series | undefined {
  return SERIES.find((s) => s.id === id);
}

export function getEpisodesForSeries(seriesId: string): Episode[] {
  return EPISODES.filter((e) => e.seriesId === seriesId).sort((a, b) => a.number - b.number);
}

export function getEpisodeById(id: string): Episode | undefined {
  return EPISODES.find((e) => e.id === id);
}
