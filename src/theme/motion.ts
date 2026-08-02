export const motion = {
  duration: {
    instant: 100,
    fast: 160,
    base: 240,
    slow: 360,
    lazy: 520,
  },
  easing: {
    standard: [0.4, 0.0, 0.2, 1] as const,
    decelerate: [0.0, 0.0, 0.2, 1] as const,
    accelerate: [0.4, 0.0, 1, 1] as const,
  },
  springs: {
    default: { damping: 18, stiffness: 220, mass: 0.9 },
    snappy: { damping: 16, stiffness: 300, mass: 0.7 },
    gentle: { damping: 20, stiffness: 140, mass: 1 },
  },
} as const;
