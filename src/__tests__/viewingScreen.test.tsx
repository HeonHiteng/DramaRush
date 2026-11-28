import React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import ViewingScreen from '../../app/viewing';
import { computeViewingStats } from '@/utils/viewingStats';
import type { Episode, Series } from '@/types';

jest.mock('@/lib/supabase', () => jest.requireActual('../testUtils/supabaseMock'));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ tab: mockTab }),
  router: { push: (path: unknown) => mockPushes.push(path), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/ui/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => {
    const { Text: RNText } = jest.requireActual('react-native');
    return <RNText>{title}</RNText>;
  },
}));
jest.mock('@/components/media', () => ({ PosterArt: () => null }));
jest.mock('@/hooks/useViewingStats', () => ({
  ...jest.requireActual('@/hooks/useViewingStats'),
  useViewingStats: () => mockStats,
}));

function makeSeries(id: string): Series {
  return {
    id,
    title: `Series ${id}`,
    synopsis: '',
    genres: ['Romance'],
    rating: 4,
    status: 'ongoing',
    language: 'English',
    posterColorFrom: '#000',
    posterColorTo: '#000',
    bannerColorFrom: '#000',
    bannerColorTo: '#000',
    cast: [],
    popularity: 1,
    isNew: false,
  };
}
function ep(seriesId: string, number: number): Episode {
  return { id: `${seriesId}-${number}`, seriesId, number, title: '', durationSec: 600, access: 'free', published: true };
}

const now = new Date().toISOString();
let mockTab: string | undefined;
const mockPushes: unknown[] = [];
const mockStats = computeViewingStats(
  {
    'a-1': { positionSec: 600, durationSec: 600, completed: true, updatedAt: now },
    'b-1': { positionSec: 600, durationSec: 600, completed: true, updatedAt: now },
    'b-2': { positionSec: 300, durationSec: 600, completed: false, updatedAt: now },
  },
  [makeSeries('a'), makeSeries('b')],
  [ep('a', 1), ep('b', 1), ep('b', 2), ep('b', 3)]
);

function texts(tree: ReactTestRenderer): string[] {
  return tree.root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));
}

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<ViewingScreen />);
  });
  return tree;
}

describe('My Viewing screen', () => {
  beforeEach(() => {
    mockPushes.length = 0;
  });

  it('shows total watch time and the series still in progress', () => {
    mockTab = undefined;
    const all = texts(render());
    expect(all).toContain('25 min');
    expect(all).toContain('Watching · 1');
    expect(all).toContain('Finished · 1');
    expect(all).toContain('Series b');
    expect(all).toContain('Watched 1 of 3 episodes');
    expect(all).not.toContain('Series a');
  });

  it('opens on the tab Profile asked for, and resumes the next unfinished episode', () => {
    mockTab = 'finished';
    const tree = render();
    expect(texts(tree)).toContain('Series a');
    mockTab = 'watching';
    const watching = render();
    const resume = watching.root.findAll((n) => n.props.accessibilityLabel === 'Resume: Series b')[0];
    act(() => resume.props.onPress());
    expect(mockPushes).toContain('/player/b-2');
  });
});
