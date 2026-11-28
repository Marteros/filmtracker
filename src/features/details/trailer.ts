import type { TmdbVideo } from '@/types';

export function findYoutubeTrailer(videos: TmdbVideo[] = []): TmdbVideo | undefined {
  const trailers = videos.filter((video) => video.site === 'YouTube' && video.key && video.type === 'Trailer');
  return trailers.find((video) => video.official) || trailers[0];
}
