import type { Movie, TmdbMovieDetails } from '@/types';
import { mapLimit } from '@/lib/concurrency';
import type { TraktMovieRef, TraktWatchedMovie, TraktWatchlistMovie } from './trakt';

export interface TraktSyncInput {
  watched: TraktWatchedMovie[];
  watchlist: TraktWatchlistMovie[];
  current: Movie[];
}

export interface TraktSyncDeps {
  getDetails(tmdbId: number, signal: AbortSignal): Promise<TmdbMovieDetails>;
  signal?: AbortSignal;
  limit?: number;
  onProgress?(done: number, total: number): void;
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function findMatchIndex(movies: Movie[], entry: TraktMovieRef) {
  const tmdbId = entry.ids?.tmdb;
  return movies.findIndex(
    (movie) =>
      (tmdbId && movie.tmdbId === tmdbId) ||
      (movie.title.toLocaleLowerCase() === entry.title.toLocaleLowerCase() &&
        movie.year === (entry.year ? String(entry.year) : undefined)),
  );
}

async function enrichMovie(movie: Movie, tmdbId: number | undefined, deps: TraktSyncDeps): Promise<Movie> {
  if (!tmdbId || (movie.posterPath && movie.releaseDate && movie.runtime && movie.genres?.length)) return movie;
  try {
    const details = await deps.getDetails(tmdbId, deps.signal ?? new AbortController().signal);
    let updated = movie;
    if (!updated.posterPath && details.poster_path) updated = { ...updated, posterPath: details.poster_path };
    if (!updated.runtime && details.runtime) updated = { ...updated, runtime: details.runtime };
    if (!updated.genres?.length && details.genres?.length)
      updated = { ...updated, genres: details.genres.map((g) => g.name) };
    if (!updated.releaseDate && details.release_date) updated = { ...updated, releaseDate: details.release_date };
    return updated;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return movie;
  }
}

export async function buildSyncedCollection(
  input: TraktSyncInput,
  deps: TraktSyncDeps,
): Promise<{ movies: Movie[]; changed: number }> {
  const next = [...input.current];
  let changed = 0;
  const enrichJobs: Array<() => Promise<void>> = [];

  const queueEnrich = (index: number, tmdbId?: number) => {
    enrichJobs.push(async () => {
      const before = next[index];
      const after = await enrichMovie(before, tmdbId || before.tmdbId, deps);
      if (after !== before) {
        next[index] = after;
        changed += 1;
      }
    });
  };

  for (const item of input.watched) {
    const entry = item.movie;
    if (!entry?.title) continue;
    const tmdbId = entry.ids?.tmdb;
    const matchIndex = findMatchIndex(next, entry);
    const watchedAt = item.last_watched_at ? Date.parse(item.last_watched_at) || undefined : undefined;
    if (matchIndex >= 0) {
      const old = next[matchIndex];
      let updated = old.status === 'seen' ? old : { ...old, status: 'seen' as const };
      if (watchedAt && !updated.watchedAt) updated = { ...updated, watchedAt };
      if (updated !== old) {
        next[matchIndex] = updated;
        changed += 1;
      }
      queueEnrich(matchIndex, tmdbId);
      continue;
    }
    const created: Movie = {
      id: createId(),
      tmdbId,
      title: entry.title,
      year: entry.year ? String(entry.year) : undefined,
      status: 'seen',
      palette: Math.floor(Math.random() * 8),
      addedAt: watchedAt || Date.now(),
      watchedAt: watchedAt || Date.now(),
    };
    next.push(created);
    changed += 1;
    queueEnrich(next.length - 1, tmdbId);
  }

  for (const item of input.watchlist) {
    const entry = item.movie;
    if (!entry?.title) continue;
    const tmdbId = entry.ids?.tmdb;
    const listedAt = item.listed_at ? Date.parse(item.listed_at) || undefined : undefined;
    const matchIndex = findMatchIndex(next, entry);
    if (matchIndex >= 0) {
      if (next[matchIndex].status === 'seen') continue;
      queueEnrich(matchIndex, tmdbId);
      continue;
    }
    const created: Movie = {
      id: createId(),
      tmdbId,
      title: entry.title,
      year: entry.year ? String(entry.year) : undefined,
      status: 'watchlist',
      palette: Math.floor(Math.random() * 8),
      addedAt: listedAt || Date.now(),
    };
    next.push(created);
    changed += 1;
    queueEnrich(next.length - 1, tmdbId);
  }

  const limit = deps.limit ?? 4;
  let done = 0;
  await mapLimit(
    enrichJobs,
    limit,
    async (job) => {
      await job();
      done += 1;
      deps.onProgress?.(done, enrichJobs.length);
    },
    deps.signal,
  );

  return { movies: next, changed };
}
