import { describe, expect, it } from 'vitest';
import { resolveSearchDestination } from './useGlobalSearch';
import type { Movie } from '@/types';

function movie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 'id-1',
    title: 'Arrival',
    year: '2016',
    status: 'seen',
    palette: 0,
    addedAt: 1,
    ...overrides,
  };
}

describe('resolveSearchDestination', () => {
  it('returns null for an empty query', () => {
    expect(resolveSearchDestination([movie()], '')).toBeNull();
    expect(resolveSearchDestination([movie()], '   ')).toBeNull();
  });

  it('sends a Seen match to the Seen tab', () => {
    expect(resolveSearchDestination([movie()], 'arrival')).toBe('history');
  });

  it('sends a Watchlist match to the Watchlist tab', () => {
    expect(resolveSearchDestination([movie({ status: 'watchlist' })], 'arrival')).toBe('watchlist');
  });

  it('prefers Seen when both tabs contain a match', () => {
    const movies = [movie({ status: 'watchlist' }), movie({ id: 'id-2', status: 'seen' })];
    expect(resolveSearchDestination(movies, 'arrival')).toBe('history');
  });

  it('falls through to Discover when nothing matches', () => {
    expect(resolveSearchDestination([movie()], 'dune')).toBe('discover');
  });

  it('does not leave the current tab for a single unmatched character', () => {
    expect(resolveSearchDestination([movie()], 'd')).toBeNull();
  });

  it('still finds a local match from a single character', () => {
    expect(resolveSearchDestination([movie()], 'a')).toBe('history');
  });

  it('matches case-insensitively on title, year and note', () => {
    expect(resolveSearchDestination([movie()], 'ARRIVAL')).toBe('history');
    expect(resolveSearchDestination([movie({ note: 'rewatch soon' })], 'rewatch')).toBe('history');
    expect(resolveSearchDestination([movie({ year: '2016' })], '2016')).toBe('history');
  });
});
