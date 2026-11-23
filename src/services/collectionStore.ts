import type { Movie, StoredCollectionV2 } from '@/types';
import { normalizeMovie } from '@/lib/validation';

export const COLLECTION_KEY_V2 = 'frame-film-journal-v2';
export const COLLECTION_KEY_V1 = 'frame-film-journal-v1';

export class CollectionStoreError extends Error {}

function readRows(raw: string): unknown[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CollectionStoreError('Stored collection is not valid JSON.');
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { movies?: unknown }).movies)) {
    return (parsed as { movies: unknown[] }).movies;
  }
  return null;
}

/**
 * Load the collection, preferring the v2 envelope and falling back to the
 * legacy v1 array. The legacy key is intentionally kept as a safety net.
 */
export function loadCollection(): Movie[] {
  const storedV2 = localStorage.getItem(COLLECTION_KEY_V2);
  if (storedV2) {
    const rows = readRows(storedV2);
    if (!rows) throw new CollectionStoreError('Stored collection has an unexpected shape.');
    return rows.map(normalizeMovie).filter((movie): movie is Movie => movie !== null);
  }

  const storedV1 = localStorage.getItem(COLLECTION_KEY_V1);
  if (storedV1) {
    const rows = readRows(storedV1);
    if (!rows) throw new CollectionStoreError('Stored collection has an unexpected shape.');
    return rows.map(normalizeMovie).filter((movie): movie is Movie => movie !== null);
  }

  return [];
}

export function saveCollection(movies: Movie[]): void {
  const payload: StoredCollectionV2 = { schemaVersion: 2, movies };
  localStorage.setItem(COLLECTION_KEY_V2, JSON.stringify(payload));
}

/** Subscribe to collection changes made in other tabs. */
export function subscribeToCollection(callback: () => void): () => void {
  function onStorage(event: StorageEvent) {
    if (event.key !== null && event.key !== COLLECTION_KEY_V2 && event.key !== COLLECTION_KEY_V1) return;
    callback();
  }
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
