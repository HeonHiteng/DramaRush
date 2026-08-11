import type { Series } from '@/types';

/** Curated gradient pairs for the admin poster/banner color picker — same
 * palette as the original seed content, offered as swatches instead of
 * requiring non-technical users to type hex codes. */
export const GRADIENT_PRESETS: {
  name: string;
  posterColorFrom: string;
  posterColorTo: string;
  bannerColorFrom: string;
  bannerColorTo: string;
}[] = [
  { name: 'Crimson', posterColorFrom: '#3A1420', posterColorTo: '#7A1F2B', bannerColorFrom: '#4A0F1A', bannerColorTo: '#8C2233' },
  { name: 'Midnight Blue', posterColorFrom: '#1B2033', posterColorTo: '#2E3A66', bannerColorFrom: '#141A2E', bannerColorTo: '#3A4A8C' },
  { name: 'Deep Teal', posterColorFrom: '#141A1C', posterColorTo: '#204045', bannerColorFrom: '#0F1517', bannerColorTo: '#2A5A61' },
  { name: 'Amber Diner', posterColorFrom: '#2B1B10', posterColorTo: '#7A4A1E', bannerColorFrom: '#20140B', bannerColorTo: '#9C5E22' },
  { name: 'Violet Glitch', posterColorFrom: '#1E1330', posterColorTo: '#5A2E8C', bannerColorFrom: '#160D26', bannerColorTo: '#7B3FB8' },
  { name: 'Ocean Blue', posterColorFrom: '#0F1E2B', posterColorTo: '#1C6E8C', bannerColorFrom: '#0B1620', bannerColorTo: '#2A8FB0' },
  { name: 'Rose Wine', posterColorFrom: '#241017', posterColorTo: '#5E1E2E', bannerColorFrom: '#1A0B10', bannerColorTo: '#7A2439' },
  { name: 'Forest Bloom', posterColorFrom: '#101F16', posterColorTo: '#2E6B45', bannerColorFrom: '#0B1710', bannerColorTo: '#3E8C58' },
];

export const LANGUAGES: Series['language'][] = ['English', 'Spanish', 'Korean', 'Portuguese'];

export const SERIES_STATUSES: Series['status'][] = ['ongoing', 'completed'];

export const EPISODE_ACCESS_TYPES: { value: 'free' | 'coin' | 'subscriber' | 'ad_unlock'; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'coin', label: 'Coins' },
  { value: 'subscriber', label: 'Members only' },
  { value: 'ad_unlock', label: 'Watch an ad' },
];
