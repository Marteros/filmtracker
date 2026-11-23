import type { Movie } from '../types';

export type MovieIdentity = Pick<Movie, 'tmdbId' | 'title' | 'year'>;

/** Stable identity for a movie: TMDb id when available, otherwise title + year. */
export function movieKey(movie: MovieIdentity): string {
  if (typeof movie.tmdbId === 'number') return `tmdb:${movie.tmdbId}`;
  return `title:${movie.title.toLocaleLowerCase()}::${movie.year ?? ''}`;
}

export function findMovie(movies: Movie[], candidate: MovieIdentity): Movie | undefined {
  const key = movieKey(candidate);
  return movies.find((movie) => movieKey(movie) === key);
}

export function findMovieById(movies: Movie[], id: string): Movie | undefined {
  return movies.find((movie) => movie.id === id);
}

export interface MergeResult {
  movies: Movie[];
  added: number;
  skipped: number;
}

/** Merge incoming movies into an existing collection without creating duplicates. */
export function mergeMovies(existing: Movie[], incoming: Movie[]): MergeResult {
  const next = [...existing];
  const ids = new Set(existing.map((movie) => movie.id));
  const keys = new Set(existing.map((movie) => movieKey(movie)));
  let added = 0;
  let skipped = 0;

  for (const movie of incoming) {
    const key = movieKey(movie);
    if (ids.has(movie.id) || keys.has(key)) {
      skipped += 1;
      continue;
    }
    next.push(movie);
    ids.add(movie.id);
    keys.add(key);
    added += 1;
  }

  return { movies: next, added, skipped };
}

/** Remove duplicates while keeping the first occurrence. */
export function dedupeMovies(movies: Movie[]): Movie[] {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  return movies.filter((movie) => {
    const key = movieKey(movie);
    if (seenIds.has(movie.id) || seenKeys.has(key)) return false;
    seenIds.add(movie.id);
    seenKeys.add(key);
    return true;
  });
}
