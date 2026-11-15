import type { Movie, MovieStatus } from '../types';

const SCHEMA_VERSION = 1;

interface BackupFile {
  schemaVersion: number;
  app: 'frame';
  exportedAt: string;
  movies: Movie[];
}

function isStatus(value: unknown): value is MovieStatus {
  return value === 'seen' || value === 'watchlist';
}

function toMovie(value: unknown): Movie | null {
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
  if (typeof raw.rating === 'number' && raw.rating >= 1 && raw.rating <= 5) movie.rating = raw.rating as Movie['rating'];
  if (typeof raw.note === 'string' && raw.note) movie.note = raw.note;
  if (typeof raw.posterPath === 'string' && raw.posterPath) movie.posterPath = raw.posterPath;
  if (typeof raw.watchedAt === 'number' && Number.isFinite(raw.watchedAt)) movie.watchedAt = raw.watchedAt;
  if (typeof raw.runtime === 'number' && Number.isFinite(raw.runtime) && raw.runtime > 0) movie.runtime = raw.runtime;
  if (Array.isArray(raw.genres)) {
    const genres = raw.genres.filter((g): g is string => typeof g === 'string' && g.trim().length > 0);
    if (genres.length) movie.genres = genres;
  }
  if (movie.status === 'watchlist') {
    delete movie.rating;
    delete movie.watchedAt;
  }
  return movie;
}

export function createBackup(movies: Movie[]): string {
  const payload: BackupFile = {
    schemaVersion: SCHEMA_VERSION,
    app: 'frame',
    exportedAt: new Date().toISOString(),
    movies,
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadBackup(movies: Movie[]) {
  const blob = new Blob([createBackup(movies)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `frame-backup-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export type ImportMode = 'merge' | 'replace';

export interface ImportResult {
  movies: Movie[];
  added: number;
  replaced: number;
  skipped: number;
  invalid: number;
}

function movieKey(movie: Movie): string {
  if (typeof movie.tmdbId === 'number') return `tmdb:${movie.tmdbId}`;
  return `title:${movie.title.toLocaleLowerCase('nl')}::${movie.year || ''}`;
}

export async function importBackup(file: File, existing: Movie[], mode: ImportMode): Promise<ImportResult> {
  const text = await file.text();
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('Dit is geen geldig JSON-bestand.'); }
  const rawMovies = Array.isArray(parsed)
    ? parsed
    : (parsed && typeof parsed === 'object' && Array.isArray((parsed as { movies?: unknown }).movies))
      ? (parsed as { movies: unknown[] }).movies
      : null;
  if (!rawMovies) throw new Error('Geen films gevonden in dit back-upbestand.');

  const incoming: Movie[] = [];
  let invalid = 0;
  for (const item of rawMovies) {
    const movie = toMovie(item);
    if (movie) incoming.push(movie); else invalid += 1;
  }
  if (!incoming.length) throw new Error('Geen geldige films gevonden in dit back-upbestand.');

  if (mode === 'replace') {
    return { movies: incoming, added: incoming.length, replaced: existing.length, skipped: 0, invalid };
  }

  const next = [...existing];
  const ids = new Set(existing.map((m) => m.id));
  const keys = new Set(existing.map(movieKey));
  let added = 0;
  let skipped = 0;
  for (const movie of incoming) {
    const key = movieKey(movie);
    if (ids.has(movie.id) || keys.has(key)) { skipped += 1; continue; }
    let id = movie.id;
    while (ids.has(id)) id = `${id}-${Math.random().toString(16).slice(2, 6)}`;
    const merged = id === movie.id ? movie : { ...movie, id };
    next.push(merged);
    ids.add(merged.id);
    keys.add(key);
    added += 1;
  }
  return { movies: next, added, replaced: 0, skipped, invalid };
}
