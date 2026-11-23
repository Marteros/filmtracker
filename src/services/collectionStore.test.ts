import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COLLECTION_KEY_V1,
  COLLECTION_KEY_V2,
  CollectionStoreError,
  loadCollection,
  saveCollection,
  subscribeToCollection,
} from './collectionStore';
import type { Movie } from '@/types';

const movie: Movie = {
  id: 'id-1',
  title: 'Arrival',
  year: '2016',
  status: 'seen',
  palette: 0,
  addedAt: 1,
};

beforeEach(() => {
  localStorage.clear();
});

describe('loadCollection', () => {
  it('returns an empty collection when nothing is stored', () => {
    expect(loadCollection()).toEqual([]);
  });

  it('reads a legacy v1 array', () => {
    localStorage.setItem(COLLECTION_KEY_V1, JSON.stringify([movie]));
    expect(loadCollection()).toEqual([movie]);
  });

  it('reads a v2 envelope and prefers it over v1', () => {
    localStorage.setItem(COLLECTION_KEY_V1, JSON.stringify([]));
    localStorage.setItem(COLLECTION_KEY_V2, JSON.stringify({ schemaVersion: 2, movies: [movie] }));
    expect(loadCollection()).toEqual([movie]);
  });

  it('normalizes invalid rows and drops them', () => {
    localStorage.setItem(COLLECTION_KEY_V1, JSON.stringify([movie, { id: 'broken' }]));
    expect(loadCollection()).toHaveLength(1);
  });

  it('throws on corrupt JSON', () => {
    localStorage.setItem(COLLECTION_KEY_V2, '{not json');
    expect(() => loadCollection()).toThrow(CollectionStoreError);
  });
});

describe('saveCollection', () => {
  it('writes a versioned envelope', () => {
    saveCollection([movie]);
    expect(JSON.parse(localStorage.getItem(COLLECTION_KEY_V2) || '{}')).toEqual({ schemaVersion: 2, movies: [movie] });
  });

  it('propagates storage errors', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveCollection([movie])).toThrow('quota');
    spy.mockRestore();
  });
});

describe('subscribeToCollection', () => {
  it('calls back for collection keys only', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToCollection(callback);
    window.dispatchEvent(new StorageEvent('storage', { key: COLLECTION_KEY_V2 }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'other-key' }));
    expect(callback).toHaveBeenCalledTimes(1);
    unsubscribe();
    window.dispatchEvent(new StorageEvent('storage', { key: COLLECTION_KEY_V2 }));
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
