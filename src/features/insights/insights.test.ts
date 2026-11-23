import { describe, expect, it } from 'vitest';
import { computeInsights } from './insights';
import type { Movie } from '@/types';

function movie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: '1',
    title: 'A',
    status: 'seen',
    palette: 0,
    addedAt: Date.parse('2024-05-10'),
    watchedAt: Date.parse('2024-05-10'),
    ...overrides,
  };
}

describe('computeInsights', () => {
  it('computes basic stats', () => {
    const stats = computeInsights(
      [
        movie({ id: '1', rating: 4, runtime: 120, genres: ['Drama'], year: '1999' }),
        movie({ id: '2', status: 'watchlist', watchedAt: undefined }),
      ],
      new Date('2024-05-15'),
    );
    expect(stats.seen).toHaveLength(1);
    expect(stats.watchlist).toHaveLength(1);
    expect(stats.avgRating).toBe(4);
    expect(stats.totalRuntime).toBe(120);
    expect(stats.topGenres[0][0]).toBe('Drama');
  });
});
