import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { VideoControls, type VideoControlsProps } from '@/components/media/VideoControls';

jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
// The real icon component loads its font asynchronously and updates state
// outside act(), flooding the output with warnings; the icons aren't under test.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

function setup(overrides: Partial<VideoControlsProps> = {}) {
  const props: VideoControlsProps = {
    visible: true,
    seriesTitle: 'Series',
    episodeTitle: 'Episode',
    episodeNumber: 1,
    totalEpisodes: 3,
    isPlaying: true,
    positionSec: 30,
    durationSec: 100,
    buffering: false,
    isFavorite: false,
    subtitlesEnabled: false,
    playbackSpeed: 1,
    isMuted: false,
    nextCountdown: null,
    hasNext: true,
    onNextEpisode: jest.fn(),
    onTogglePlay: jest.fn(),
    onClose: jest.fn(),
    onToggleFavorite: jest.fn(),
    onShare: jest.fn(),
    onOpenEpisodeList: jest.fn(),
    onToggleSubtitles: jest.fn(),
    onCycleSpeed: jest.fn(),
    onToggleMute: jest.fn(),
    onSeek: jest.fn(),
    onCancelCountdown: jest.fn(),
    ...overrides,
  };
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<VideoControls {...props} />);
  });
  const pressables = (label: string) =>
    tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');
  const press = (label: string) => {
    const [target] = pressables(label);
    if (!target) throw new Error(`No pressable labelled "${label}"`);
    act(() => target.props.onPress({ stopPropagation: () => {} }));
  };
  return { props, pressables, press };
}

describe('VideoControls', () => {
  it('pauses from the center button (portrait had no way to pause before)', () => {
    const { props, press } = setup({ isPlaying: true });
    press('Pause video');
    expect(props.onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('offers Play while paused', () => {
    const { props, press } = setup({ isPlaying: false });
    press('Play video');
    expect(props.onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('skips 10 seconds back and forward as a ratio of the duration', () => {
    const { props, press } = setup({ positionSec: 30, durationSec: 100 });
    press('Forward 10 seconds');
    press('Back 10 seconds');
    expect(props.onSeek).toHaveBeenNthCalledWith(1, 0.4);
    expect(props.onSeek).toHaveBeenNthCalledWith(2, 0.2);
  });

  it('clamps skipping to the start and end of the video', () => {
    const { props, press } = setup({ positionSec: 95, durationSec: 100 });
    press('Forward 10 seconds');
    expect(props.onSeek).toHaveBeenLastCalledWith(1);

    const early = setup({ positionSec: 4, durationSec: 100 });
    early.press('Back 10 seconds');
    expect(early.props.onSeek).toHaveBeenLastCalledWith(0);
  });

  it('hides the skip buttons until the duration is known', () => {
    const { pressables } = setup({ durationSec: 0 });
    expect(pressables('Forward 10 seconds')).toHaveLength(0);
    expect(pressables('Back 10 seconds')).toHaveLength(0);
  });

  it('shows Next Episode only when there is a next episode', () => {
    const withNext = setup({ hasNext: true });
    withNext.press('Next Episode');
    expect(withNext.props.onNextEpisode).toHaveBeenCalledTimes(1);

    const lastEpisode = setup({ hasNext: false });
    expect(lastEpisode.pressables('Next Episode')).toHaveLength(0);
  });

  it('hides the center controls while buffering', () => {
    const { pressables } = setup({ buffering: true });
    expect(pressables('Pause video')).toHaveLength(0);
  });
});
