import React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ActivityIndicator, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { __getTable, __reset, supabase } from '../testUtils/supabaseMock';
import PlayerScreen from '../../app/player/[episodeId]';
import { useUserStore } from '@/store/userStore';
import { useAccountGateStore } from '@/hooks/useAccountGate';
import type { LockReason } from '@/features/player/PlayerPage';

jest.mock('@/lib/supabase', () => jest.requireActual('../testUtils/supabaseMock'));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ episodeId: mockRequestedEpisode }),
  useIsFocused: () => true,
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/hooks/usePlaybackProtection', () => ({ usePlaybackProtection: () => {} }));
// The pages themselves (video, overlays) aren't under test: record what the screen asks of them.
jest.mock('@/features/player/PlayerPage', () => ({
  PlayerPage: (props: { episode: { id: string }; isActive: boolean; onLocked: (reason: LockReason) => void }) => {
    mockPages.set(props.episode.id, props.isActive);
    mockOnLocked.set(props.episode.id, props.onLocked);
    return null;
  },
}));
jest.mock('@/features/player/RewardedAdOverlay', () => ({ RewardedAdOverlay: () => null }));
jest.mock('@/features/player/EpisodeListSheet', () => ({ EpisodeListSheet: () => null }));
jest.mock('@/components/ui/PaywallSheet', () => ({
  PaywallSheet: (props: { visible: boolean; adOnly?: boolean }) => {
    mockPaywall = { visible: props.visible, adOnly: !!props.adOnly };
    return null;
  },
}));
jest.mock('@/components/ui/BottomSheet', () => ({ BottomSheet: () => null }));
jest.mock('@/components/ui/AccountGateSheet', () => ({ AccountGateSheet: () => null }));
// Reanimated needs its native worklets runtime; only the not-found state uses EmptyState.
jest.mock('@/components/ui/EmptyState', () => ({ EmptyState: () => null }));

let mockRequestedEpisode = 'ep-ad';
const mockPages = new Map<string, boolean>();
const mockOnLocked = new Map<string, (reason: LockReason) => void>();
let mockPaywall = { visible: false, adOnly: false };

/** Holds every read of `table` until release() — the cold-load case, where nothing is cached yet. */
function holdTable(table: string) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const realFrom = supabase.from;
  jest.spyOn(supabase, 'from').mockImplementation((name: string) => {
    const builder = realFrom(name);
    if (name !== table) return builder;
    const realThen = builder.then.bind(builder);
    builder.then = ((onFulfilled, onRejected) => gate.then(() => realThen(onFulfilled, onRejected))) as typeof builder.then;
    return builder;
  });
  return release;
}

/** react-query delivers results on a setTimeout(0) tick, so let real ticks pass. */
async function flush() {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function layoutRoot(tree: ReactTestRenderer) {
  return tree.root.findAll((node) => node.type === View && typeof node.props.onLayout === 'function')[0];
}

describe('player screen: cold load', () => {
  beforeEach(() => {
    __reset();
    mockPages.clear();
    __getTable('episodes').forEach((e) => Object.assign(e, { duration_sec: 80, published: true }));
    Object.assign(__getTable('series')[0], { genres: [], rating: 4.5, cast_members: [] });
  });

  afterEach(() => jest.restoreAllMocks());

  it.each(['ep-ad', 'ep-coin', 'ep-member'])(
    'activates the requested episode (%s) once the list arrives asynchronously',
    async (episodeId) => {
      mockRequestedEpisode = episodeId;
      const releaseEpisodes = holdTable('episodes');
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      let tree!: ReactTestRenderer;
      act(() => {
        tree = renderer.create(
          <QueryClientProvider client={client}>
            <PlayerScreen />
          </QueryClientProvider>
        );
      });
      await flush();
      // Still loading: nothing rendered as a page yet.
      expect(mockPages.size).toBe(0);
      const loadingRoot = tree.root.findAll((node) => node.type === View)[0];
      expect(loadingRoot.findAllByType(ActivityIndicator)).toHaveLength(1);

      releaseEpisodes();
      await flush();
      const root = layoutRoot(tree);
      // A fresh View, not the loading one updated in place: react-native-web
      // only observes layout for a View that has onLayout when it mounts, so
      // an updated loading View never reported a size on a cold web load.
      expect(root).toBeDefined();
      expect(root).not.toBe(loadingRoot);
      act(() => root.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } }));
      await flush();

      expect(mockPages.get(episodeId)).toBe(true);
      const active = [...mockPages].filter(([, isActive]) => isActive).map(([id]) => id);
      expect(active).toEqual([episodeId]);
      act(() => tree.unmount());
      client.clear();
    }
  );
});

describe('player screen: locked episodes', () => {
  let tree: ReactTestRenderer;
  let client: QueryClient;

  async function open(episodeId: string, provider: 'guest' | 'google') {
    __reset();
    mockPages.clear();
    mockOnLocked.clear();
    mockPaywall = { visible: false, adOnly: false };
    useAccountGateStore.getState().close();
    useUserStore.setState({ user: { id: 'u1', displayName: 'U', avatarSeed: 'U', provider, createdAt: '', isAdmin: false } });
    __getTable('episodes').forEach((e) => Object.assign(e, { duration_sec: 80, published: true }));
    Object.assign(__getTable('series')[0], { genres: [], rating: 4.5, cast_members: [] });
    mockRequestedEpisode = episodeId;
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    act(() => {
      tree = renderer.create(
        <QueryClientProvider client={client}>
          <PlayerScreen />
        </QueryClientProvider>
      );
    });
    await flush();
    act(() => layoutRoot(tree).props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } }));
    await flush();
  }

  function lock(episodeId: string, reason: LockReason) {
    act(() => mockOnLocked.get(episodeId)!(reason));
  }

  afterEach(() => {
    act(() => tree.unmount());
    client.clear();
    useUserStore.setState({ user: null });
  });

  it('offers a guest the ad-only paywall on an ad episode', async () => {
    await open('ep-ad', 'guest');
    lock('ep-ad', 'locked');
    expect(mockPaywall).toEqual({ visible: true, adOnly: true });
    expect(useAccountGateStore.getState().reason).toBeNull();
  });

  it.each(['ep-coin', 'ep-member'])('sends a guest to the link-account gate on %s', async (episodeId) => {
    await open(episodeId, 'guest');
    lock(episodeId, 'locked');
    expect(useAccountGateStore.getState().reason).toBe('paywall');
    expect(mockPaywall.visible).toBe(false);

    useAccountGateStore.getState().close();
    lock(episodeId, 'account_required');
    expect(useAccountGateStore.getState().reason).toBe('paywall');
  });

  it('gives a member the full paywall', async () => {
    await open('ep-coin', 'google');
    lock('ep-coin', 'locked');
    expect(mockPaywall).toEqual({ visible: true, adOnly: false });
    expect(useAccountGateStore.getState().reason).toBeNull();
  });
});
