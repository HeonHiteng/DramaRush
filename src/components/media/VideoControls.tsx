import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, gradients, radius, spacing, typography } from '@/theme';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { formatDuration } from '@/utils/format';
import { useTranslation } from '@/i18n/useTranslation';

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
  hasNext: boolean;
  onNextEpisode: () => void;
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
  hasNext,
  onNextEpisode,
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
  const canSkip = durationSec > 0;
  const { t } = useTranslation();

  const skipBy = (seconds: number) => {
    if (!canSkip) return;
    onSeek(Math.max(0, Math.min(1, (positionSec + seconds) / durationSec)));
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.boxNone]}>
      {buffering && (
        <View style={[styles.bufferingWrap, styles.eventsNone]}>
          <View style={styles.bufferingRing} />
        </View>
      )}

      {/* Netflix's center controls. The play/pause button here is the only
          way to pause in portrait: tapping elsewhere just shows/hides the
          controls (PlayerPage's full-screen Pressable). */}
      {visible && !buffering && (
        <View style={[styles.centerControls, styles.boxNone]}>
          {canSkip && <SkipButton direction="back" label={t('player.skipBack')} onPress={() => skipBy(-10)} />}
          <Pressable
            onPress={onTogglePlay}
            hitSlop={8}
            style={styles.centerPlayCircle}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? t('player.pauseVideo') : t('player.playVideo')}
          >
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color={colors.white} />
          </Pressable>
          {canSkip && <SkipButton direction="forward" label={t('player.skipForward')} onPress={() => skipBy(10)} />}
        </View>
      )}

      {visible && (
        <>
          <LinearGradient colors={gradients.scrimTop} style={[styles.topScrim, { paddingTop: insets.top + spacing.xs }]}>
            <View style={styles.topBar}>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('player.closePlayer')} hitSlop={10} style={styles.iconButton}>
                <Ionicons name="chevron-down" size={26} color={colors.white} />
              </Pressable>
              <View style={styles.topTitleWrap}>
                <Text style={styles.topTitle} numberOfLines={1}>
                  {seriesTitle}
                </Text>
                <Text style={styles.topSubtitle} numberOfLines={1}>
                  {t('player.episodeMeta', { number: episodeNumber, total: totalEpisodes, title: episodeTitle })}
                </Text>
              </View>
            </View>
          </LinearGradient>

          <View style={[styles.sideRail, { top: insets.top + 90 }]}>
            <SideAction icon={isFavorite ? 'checkmark' : 'add'} label={t('series.myList')} onPress={onToggleFavorite} />
            <SideAction icon="share-social" label={t('player.share')} onPress={onShare} />
            <SideAction
              icon="chatbox-ellipses"
              label={subtitlesEnabled ? t('player.ccOn') : t('player.ccOff')}
              active={subtitlesEnabled}
              onPress={onToggleSubtitles}
            />
            <SideAction icon="speedometer" label={`${playbackSpeed}x`} onPress={onCycleSpeed} />
            <SideAction icon={isMuted ? 'volume-mute' : 'volume-high'} label={t('player.volume')} onPress={onToggleMute} />
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
            <View style={styles.bottomActions}>
              <BottomAction icon="layers-outline" label={t('series.episodes')} accessibilityLabel={t('player.episodeListLabel')} onPress={onOpenEpisodeList} />
              {hasNext && <BottomAction icon="play-skip-forward" label={t('player.nextEpisode')} onPress={onNextEpisode} />}
            </View>
          </LinearGradient>

          {nextCountdown !== null && (
            <View style={[styles.countdownWrap, { bottom: insets.bottom + 110 }]}>
              <Text style={styles.countdownText}>{t('player.nextEpisodeIn', { seconds: nextCountdown })}</Text>
              <Pressable onPress={onCancelCountdown} style={styles.countdownCancel} accessibilityRole="button" accessibilityLabel={t('player.cancelAutoplay')}>
                <Text style={styles.countdownCancelText}>{t('common.cancel')}</Text>
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

/** Netflix's ⟲10 / 10⟳ buttons: a circular arrow with "10" in the middle. */
function SkipButton({ direction, label, onPress }: { direction: 'back' | 'forward'; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.skipButton} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name="refresh" size={36} color={colors.white} style={direction === 'back' ? styles.mirrored : undefined} />
      <Text style={styles.skipText}>10</Text>
    </Pressable>
  );
}

function BottomAction({
  icon,
  label,
  accessibilityLabel,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.bottomAction} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}>
      <Ionicons name={icon} size={18} color={colors.white} />
      <Text style={styles.bottomActionText}>{label}</Text>
    </Pressable>
  );
}

function SeekBar({ progress, onSeek }: { progress: number; onSeek: (ratio: number) => void }) {
  const widthRef = React.useRef(1);
  const { t } = useTranslation();
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
      accessibilityLabel={t('player.seek')}
    >
      <ProgressBar progress={progress} height={4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boxNone: { pointerEvents: 'box-none' },
  eventsNone: { pointerEvents: 'none' },
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
  centerControls: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  centerPlayCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  mirrored: { transform: [{ scaleX: -1 }] },
  skipText: { position: 'absolute', ...typography.micro, color: colors.white, fontWeight: '700' },
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
  bottomActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  bottomAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, paddingVertical: spacing.xxs },
  bottomActionText: { ...typography.bodyMedium, color: colors.white },
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
