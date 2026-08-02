import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, gradients, radius, spacing, typography } from '@/theme';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { formatDuration } from '@/utils/format';

export interface VideoControlsProps {
  visible: boolean;
  seriesTitle: string;
  episodeTitle: string;
  episodeNumber: number;
  totalEpisodes: number;
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  buffering: boolean;
  isFavorite: boolean;
  subtitlesEnabled: boolean;
  playbackSpeed: number;
  isMuted: boolean;
  nextCountdown: number | null;
  onTogglePlay: () => void;
  onClose: () => void;
  onToggleFavorite: () => void;
  onShare: () => void;
  onOpenEpisodeList: () => void;
  onToggleSubtitles: () => void;
  onCycleSpeed: () => void;
  onToggleMute: () => void;
  onSeek: (ratio: number) => void;
  onCancelCountdown: () => void;
}

export function VideoControls({
  visible,
  seriesTitle,
  episodeTitle,
  episodeNumber,
  totalEpisodes,
  isPlaying,
  positionSec,
  durationSec,
  buffering,
  isFavorite,
  subtitlesEnabled,
  playbackSpeed,
  isMuted,
  nextCountdown,
  onTogglePlay,
  onClose,
  onToggleFavorite,
  onShare,
  onOpenEpisodeList,
  onToggleSubtitles,
  onCycleSpeed,
  onToggleMute,
  onSeek,
  onCancelCountdown,
}: VideoControlsProps) {
  const insets = useSafeAreaInsets();
  const progress = durationSec > 0 ? positionSec / durationSec : 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {buffering && (
        <View style={styles.bufferingWrap} pointerEvents="none">
          <View style={styles.bufferingRing} />
        </View>
      )}

      {!isPlaying && !buffering && visible && (
        <View style={styles.centerPlayWrap} pointerEvents="none">
          <View style={styles.centerPlayCircle}>
            <Ionicons name="play" size={30} color={colors.white} />
          </View>
        </View>
      )}

      {visible && (
        <>
          <LinearGradient colors={gradients.scrimTop} style={[styles.topScrim, { paddingTop: insets.top + spacing.xs }]}>
            <View style={styles.topBar}>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close player" hitSlop={10} style={styles.iconButton}>
                <Ionicons name="chevron-down" size={26} color={colors.white} />
              </Pressable>
              <View style={styles.topTitleWrap}>
                <Text style={styles.topTitle} numberOfLines={1}>
                  {seriesTitle}
                </Text>
                <Text style={styles.topSubtitle} numberOfLines={1}>
                  EP {episodeNumber} of {totalEpisodes} · {episodeTitle}
                </Text>
              </View>
              <Pressable
                onPress={onOpenEpisodeList}
                accessibilityRole="button"
                accessibilityLabel="Episode list"
                hitSlop={10}
                style={styles.iconButton}
              >
                <Ionicons name="list" size={22} color={colors.white} />
              </Pressable>
            </View>
          </LinearGradient>

          <View style={[styles.sideRail, { top: insets.top + 90 }]}>
            <SideAction
              icon={isFavorite ? 'heart' : 'heart-outline'}
              color={isFavorite ? colors.accent : colors.white}
              label="Favorite"
              onPress={onToggleFavorite}
            />
            <SideAction icon="share-social" label="Share" onPress={onShare} />
            <SideAction
              icon="chatbox-ellipses"
              label={subtitlesEnabled ? 'CC On' : 'CC Off'}
              active={subtitlesEnabled}
              onPress={onToggleSubtitles}
            />
            <SideAction icon="speedometer" label={`${playbackSpeed}x`} onPress={onCycleSpeed} />
            <SideAction icon={isMuted ? 'volume-mute' : 'volume-high'} label="Volume" onPress={onToggleMute} />
          </View>

          <LinearGradient
            colors={gradients.scrimBottom}
            style={[styles.bottomScrim, { paddingBottom: insets.bottom + spacing.md }]}
          >
            <View style={styles.progressRow}>
              <Text style={styles.time}>{formatDuration(positionSec)}</Text>
              <View style={styles.progressBarWrap}>
                <SeekBar progress={progress} onSeek={onSeek} />
              </View>
              <Text style={styles.time}>{formatDuration(durationSec)}</Text>
            </View>
          </LinearGradient>

          {nextCountdown !== null && (
            <View style={[styles.countdownWrap, { bottom: insets.bottom + 70 }]}>
              <Text style={styles.countdownText}>Next episode in {nextCountdown}s</Text>
              <Pressable onPress={onCancelCountdown} style={styles.countdownCancel} accessibilityRole="button" accessibilityLabel="Cancel autoplay">
                <Text style={styles.countdownCancelText}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );
}

function SideAction({
  icon,
  label,
  onPress,
  color = colors.white,
  active = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={styles.sideAction}
    >
      <View style={[styles.sideIconCircle, active && styles.sideIconCircleActive]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.sideLabel}>{label}</Text>
    </Pressable>
  );
}

function SeekBar({ progress, onSeek }: { progress: number; onSeek: (ratio: number) => void }) {
  const widthRef = React.useRef(1);
  return (
    <Pressable
      onPress={(e) => {
        const { locationX } = e.nativeEvent;
        onSeek(Math.max(0, Math.min(1, locationX / widthRef.current)));
      }}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width || 1;
      }}
      style={styles.seekTouchArea}
      accessibilityRole="adjustable"
      accessibilityLabel="Seek"
    >
      <ProgressBar progress={progress} height={4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bufferingWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bufferingRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.25)',
    borderTopColor: colors.white,
  },
  centerPlayWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  centerPlayCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: spacing.lg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitleWrap: { flex: 1 },
  topTitle: { ...typography.bodyMedium, color: colors.white },
  topSubtitle: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
  sideRail: { position: 'absolute', right: spacing.sm, gap: spacing.lg, alignItems: 'center' },
  sideAction: { alignItems: 'center', gap: 4 },
  sideIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideIconCircleActive: { backgroundColor: colors.accentMuted },
  sideLabel: { ...typography.micro, color: colors.white },
  bottomScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: spacing.xxl, paddingHorizontal: spacing.md },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  time: { ...typography.caption, color: colors.white, minWidth: 36, textAlign: 'center' },
  progressBarWrap: { flex: 1 },
  seekTouchArea: { paddingVertical: spacing.sm },
  countdownWrap: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  countdownText: { ...typography.bodyMedium, color: colors.white },
  countdownCancel: { paddingHorizontal: spacing.sm, paddingVertical: 4, backgroundColor: colors.surfaceRaised, borderRadius: radius.sm },
  countdownCancelText: { ...typography.caption, color: colors.textPrimary },
});
