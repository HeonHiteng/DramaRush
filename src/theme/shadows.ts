import { Platform } from 'react-native';

const shadow = (elevation: number, opacity: number, radius: number) =>
  Platform.select({
    android: { elevation },
    default: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: Math.round(elevation / 2) },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
  });

export const shadows = {
  card: shadow(4, 0.28, 8),
  raised: shadow(8, 0.32, 16),
  floating: shadow(14, 0.38, 24),
} as const;
