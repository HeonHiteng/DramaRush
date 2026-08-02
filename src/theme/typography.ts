import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

export const typography = {
  fontFamily,
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800' as const, letterSpacing: -0.4 },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: '800' as const, letterSpacing: -0.3 },
  h2: { fontSize: 21, lineHeight: 27, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '700' as const, letterSpacing: -0.1 },
  bodyLg: { fontSize: 16, lineHeight: 22, fontWeight: '500' as const },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  micro: { fontSize: 10.5, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 0.2 },
  button: { fontSize: 15, lineHeight: 20, fontWeight: '700' as const, letterSpacing: 0.1 },
} as const;
