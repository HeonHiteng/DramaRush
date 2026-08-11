import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { motifForSeries } from '@/data/posterMotifs';
import type { Series } from '@/types';

interface PosterArtProps {
  series: Series;
  size?: 'thumb' | 'hero';
}

/** Symbolic "poster" treatment layered over a series' gradient — a large
 * rotated genre icon plus a diagonal sheen, standing in for real artwork
 * (no photographic assets exist for this original, fictional catalog).
 * Drop inside an existing <LinearGradient> as an absolutely-filled child. */
export function PosterArt({ series, size = 'thumb' }: PosterArtProps) {
  const motif = motifForSeries(series.id);
  const iconSize = size === 'hero' ? 220 : 96;

  return (
    <View style={[StyleSheet.absoluteFill, styles.noPointerEvents]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.motifWrap, size === 'hero' ? styles.motifWrapHero : styles.motifWrapThumb]}>
        <Ionicons name={motif} size={iconSize} color="rgba(255,255,255,0.22)" style={styles.motifIcon} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  noPointerEvents: { pointerEvents: 'none' },
  motifWrap: { position: 'absolute' },
  motifWrapThumb: { right: -18, bottom: -14 },
  motifWrapHero: { right: -24, bottom: -30 },
  motifIcon: { transform: [{ rotate: '-14deg' }] },
});
