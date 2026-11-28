import { describe, expect, it } from 'vitest';
import type { TmdbVideo } from '@/types';
import { findYoutubeTrailer } from './trailer';

const video = (overrides: Partial<TmdbVideo> = {}): TmdbVideo => ({
  key: 'trailer-key',
  name: 'Trailer',
  site: 'YouTube',
  type: 'Trailer',
  ...overrides,
});

describe('findYoutubeTrailer', () => {
  it('prefers an official YouTube trailer', () => {
    const official = video({ key: 'official', official: true });
    expect(findYoutubeTrailer([video(), official])).toBe(official);
  });

  it('does not return non-trailers or videos from other sites', () => {
    expect(findYoutubeTrailer([video({ site: 'Vimeo' }), video({ type: 'Behind the Scenes' })])).toBeUndefined();
  });
});
