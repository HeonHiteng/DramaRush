export const palette = {
  charcoal950: '#0B090D',
  charcoal900: '#121014',
  charcoal850: '#17151A',
  charcoal800: '#1E1B21',
  charcoal700: '#2A262D',
  charcoal600: '#3A3540',
  charcoal500: '#4E4854',
  charcoal400: '#6B6570',
  charcoal300: '#948E99',
  charcoal200: '#C1BCC4',
  charcoal100: '#E3E0E5',
  charcoal50: '#F5F3F6',

  coral500: '#FF5A5F',
  coral400: '#FF7A7E',
  coral600: '#E8474C',
  coral700: '#C93A3F',

  gold500: '#F4B942',
  gold400: '#F8CB6E',
  gold600: '#D89E28',

  emerald500: '#3DDC84',
  sapphire500: '#4E8CFF',

  white: '#FFFFFF',
  black: '#000000',
} as const;

export const colors = {
  bg: palette.charcoal950,
  bgElevated: palette.charcoal900,
  surface: palette.charcoal850,
  surfaceRaised: palette.charcoal800,
  surfaceBorder: palette.charcoal700,

  textPrimary: palette.charcoal50,
  textSecondary: palette.charcoal200,
  textTertiary: palette.charcoal300,
  textDisabled: palette.charcoal500,
  textInverse: palette.charcoal950,

  accent: palette.coral500,
  accentPressed: palette.coral600,
  accentMuted: 'rgba(255, 90, 95, 0.16)',

  gold: palette.gold500,
  goldMuted: 'rgba(244, 185, 66, 0.16)',

  success: palette.emerald500,
  info: palette.sapphire500,
  danger: palette.coral600,

  overlay: 'rgba(11, 9, 13, 0.72)',
  overlaySoft: 'rgba(11, 9, 13, 0.4)',
  scrim: 'rgba(0, 0, 0, 0.55)',

  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',

  white: palette.white,
  black: palette.black,
} as const;

export const gradients = {
  heroFade: ['transparent', 'rgba(11,9,13,0.6)', palette.charcoal950] as const,
  posterFade: ['transparent', 'rgba(11,9,13,0.92)'] as const,
  coralGlow: [palette.coral500, palette.coral700] as const,
  goldGlow: [palette.gold400, palette.gold600] as const,
  premiumBanner: ['#2A1B2E', '#3A1F2A', '#4A2430'] as const,
  splash: [palette.charcoal950, '#1A1420', palette.charcoal950] as const,
  scrimTop: ['rgba(11,9,13,0.85)', 'transparent'] as const,
  scrimBottom: ['transparent', 'rgba(11,9,13,0.95)'] as const,
} as const;
