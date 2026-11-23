import { describe, expect, it } from 'vitest';
import { dedupeMovies, findMovie, mergeMovies, movieKey } from './movie';
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

describe('movieKey', () => {
  it('prefers the TMDb id', () => {
    expect(movieKey({ tmdbId: 42, title: 'Arrival', year: '2016' })).toBe('tmdb:42');
  });

  it('falls back to a case-insensitive title and year', () => {
    expect(movieKey({ title: 'Arrival', year: '2016' })).toBe('title:arrival::2016');
    expect(movieKey({ title: 'ARRIVAL', year: undefined })).toBe('title:arrival::');
  });
});

describe('findMovie', () => {
  it('matches by TMDb id before title', () => {
    const movies = [movie({ tmdbId: 7, title: 'Other' })];
    expect(findMovie(movies, { tmdbId: 7, title: 'Arrival', year: '2016' })?.id).toBe('id-1');
  });

  it('returns undefined when there is no match', () => {
    expect(findMovie([movie()], { title: 'Dune', year: '2021' })).toBeUndefined();
  });
});

describe('mergeMovies', () => {
  it('adds new movies and skips duplicates', () => {
    const existing = [movie()];
    const result = mergeMovies(existing, [movie({ id: 'id-2' }), movie({ id: 'id-3', title: 'Dune', year: '2021' })]);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.movies.map((m) => m.title)).toEqual(['Arrival', 'Dune']);
  });

  it('skips a movie that reuses an existing id', () => {
    const result = mergeMovies([movie()], [movie({ id: 'id-1', title: 'Dune', year: '2021' })]);
    expect(result.added).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.movies).toHaveLength(1);
  });
});

describe('dedupeMovies', () => {
  it('keeps the first occurrence', () => {
    const result = dedupeMovies([movie(), movie({ id: 'id-2' }), movie({ id: 'id-3', title: 'Dune' })]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('id-1');
  });
});
