import type { Movie, MovieRating, MovieStatus } from '@/types';

function isStatus(value: unknown): value is MovieStatus {
  return value === 'seen' || value === 'watchlist';
}

export function isMovieRating(value: unknown): value is MovieRating {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

/**
 * Normalize untrusted data (storage, backup, network) into a valid movie.
 * Returns `null` when required fields are missing.
 */
export function normalizeMovie(value: unknown): Movie | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<Movie> & Record<string, unknown>;
  if (typeof raw.id !== 'string' || typeof raw.title !== 'string' || !isStatus(raw.status)) return null;
  const addedAt = typeof raw.addedAt === 'number' && Number.isFinite(raw.addedAt) ? raw.addedAt : Date.now();
  const movie: Movie = {
    id: raw.id,
    title: raw.title,
    status: raw.status,
    palette: typeof raw.palette === 'number' && Number.isFinite(raw.palette) ? raw.palette : 0,
    addedAt,
  };
  if (typeof raw.tmdbId === 'number' && Number.isFinite(raw.tmdbId)) movie.tmdbId = raw.tmdbId;
  if (typeof raw.year === 'string' && raw.year) movie.year = raw.year;
  if (isMovieRating(raw.rating)) movie.rating = raw.rating;
  if (typeof raw.note === 'string' && raw.note) movie.note = raw.note;
  if (typeof raw.posterPath === 'string' && raw.posterPath) movie.posterPath = raw.posterPath;
  if (typeof raw.releaseDate === 'string' && raw.releaseDate) movie.releaseDate = raw.releaseDate;
  if (typeof raw.watchedAt === 'number' && Number.isFinite(raw.watchedAt)) movie.watchedAt = raw.watchedAt;
  if (typeof raw.runtime === 'number' && Number.isFinite(raw.runtime) && raw.runtime > 0) movie.runtime = raw.runtime;
  if (Array.isArray(raw.genres)) {
    const genres = raw.genres.filter((genre): genre is string => typeof genre === 'string' && genre.trim().length > 0);
    if (genres.length) movie.genres = genres;
  }
  if (movie.status === 'watchlist') {
    delete movie.rating;
    delete movie.watchedAt;
  }
  return movie;
}

export const isMovie = (value: unknown): value is Movie => normalizeMovie(value) !== null;
