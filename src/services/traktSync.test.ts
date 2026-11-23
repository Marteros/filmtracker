import { describe, expect, it, vi } from 'vitest';
import { buildSyncedCollection } from './traktSync';
import type { Movie } from '@/types';

function movie(overrides: Partial<Movie> = {}): Movie {
  return { id: '1', title: 'Arrival', status: 'watchlist', palette: 0, addedAt: 1, ...overrides };
}

describe('buildSyncedCollection', () => {
  it('marks watched items as seen and preserves addedAt', async () => {
    const current = [movie({ id: '1', tmdbId: 10, title: 'Arrival', status: 'watchlist', addedAt: 100 })];
    const result = await buildSyncedCollection(
      {
        watched: [
          {
            movie: { title: 'Arrival', year: 2016, ids: { tmdb: 10 } },
            last_watched_at: '2024-01-01T00:00:00.000Z',
          } as any,
        ],
        watchlist: [],
        current,
      },
      { getDetails: vi.fn().mockResolvedValue({}), limit: 2 },
    );
    expect(result.movies[0].status).toBe('seen');
    expect(result.movies[0].addedAt).toBe(100);
    expect(result.movies[0].watchedAt).toBe(Date.parse('2024-01-01T00:00:00.000Z'));
  });

  it('does not downgrade a seen movie from watchlist', async () => {
    const current = [movie({ id: '1', tmdbId: 10, status: 'seen', addedAt: 100 })];
    const result = await buildSyncedCollection(
      { watched: [], watchlist: [{ movie: { title: 'Arrival', ids: { tmdb: 10 } } } as any], current },
      { getDetails: vi.fn().mockResolvedValue({}), limit: 2 },
    );
    expect(result.movies[0].status).toBe('seen');
  });
});
