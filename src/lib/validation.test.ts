import { describe, expect, it } from 'vitest';
import { normalizeMovie } from './validation';

const valid = {
  id: 'id-1',
  title: 'Arrival',
  status: 'seen',
  palette: 1,
  addedAt: 100,
  rating: 4,
  watchedAt: 200,
};

describe('normalizeMovie', () => {
  it('keeps a valid movie', () => {
    expect(normalizeMovie(valid)).toMatchObject({ id: 'id-1', title: 'Arrival', rating: 4 });
  });

  it('rejects values without required fields', () => {
    expect(normalizeMovie(null)).toBeNull();
    expect(normalizeMovie({})).toBeNull();
    expect(normalizeMovie({ ...valid, status: 'unknown' })).toBeNull();
  });

  it('drops rating and watchedAt for watchlist movies', () => {
    const result = normalizeMovie({ ...valid, status: 'watchlist' });
    expect(result?.rating).toBeUndefined();
    expect(result?.watchedAt).toBeUndefined();
  });

  it('ignores out-of-range ratings', () => {
    expect(normalizeMovie({ ...valid, rating: 9 })?.rating).toBeUndefined();
  });

  it('fills a missing addedAt', () => {
    expect(normalizeMovie({ ...valid, addedAt: undefined })?.addedAt).toBeTypeOf('number');
  });
});
