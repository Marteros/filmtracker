import type { Movie } from '@/types';
import { mergeMovies } from '@/lib/movie';
import { normalizeMovie } from '@/lib/validation';

const SCHEMA_VERSION = 1;

interface BackupFile {
  schemaVersion: number;
  app: 'frame';
  exportedAt: string;
  movies: Movie[];
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

export async function importBackup(file: File, existing: Movie[], mode: ImportMode): Promise<ImportResult> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This is not a valid JSON file.');
  }
  const rawMovies = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { movies?: unknown }).movies)
      ? (parsed as { movies: unknown[] }).movies
      : null;
  if (!rawMovies) throw new Error('No movies found in this backup file.');

  const incoming: Movie[] = [];
  let invalid = 0;
  for (const item of rawMovies) {
    const movie = normalizeMovie(item);
    if (movie) incoming.push(movie);
    else invalid += 1;
  }
  if (!incoming.length) throw new Error('No valid movies found in this backup file.');

  if (mode === 'replace') {
    return { movies: incoming, added: incoming.length, replaced: existing.length, skipped: 0, invalid };
  }

  const merged = mergeMovies(existing, incoming);
  return { movies: merged.movies, added: merged.added, replaced: 0, skipped: merged.skipped, invalid };
}
