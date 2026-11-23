import { useCallback, useEffect, useRef, useState } from 'react';
import type { Movie } from '../types';
import { findMovieById, mergeMovies } from '../lib/movie';
import {
  CollectionStoreError,
  loadCollection,
  saveCollection,
  subscribeToCollection,
} from '../services/collectionStore';

const STORAGE_ERROR = 'Could not save. Check the available storage on this device.';

export interface CollectionApi {
  movies: Movie[];
  storageError: string;
  addMovie(movie: Movie): boolean;
  updateMovie(id: string, patch: Partial<Movie>): boolean;
  removeMovie(id: string): boolean;
  replaceAll(movies: Movie[]): boolean;
  mergeMany(movies: Movie[]): boolean;
  enrichMovie(id: string, patch: Partial<Pick<Movie, 'runtime' | 'genres' | 'posterPath' | 'releaseDate'>>): void;
  findById(id: string): Movie | undefined;
}

function readInitialCollection(): { movies: Movie[]; error: string } {
  try {
    return { movies: loadCollection(), error: '' };
  } catch (error) {
    const corrupt = error instanceof CollectionStoreError;
    return {
      movies: [],
      error: corrupt ? 'Stored collection could not be read. A backup has not been overwritten.' : STORAGE_ERROR,
    };
  }
}

/**
 * Single source of truth for the collection.
 *
 * Writes go straight to storage before the React state changes, so a failed
 * write never leaves the UI showing data that was not persisted.
 */
export function useCollection(): CollectionApi {
  const [initial] = useState(readInitialCollection);
  const [movies, setMovies] = useState<Movie[]>(initial.movies);
  const [storageError, setStorageError] = useState(initial.error);
  const moviesRef = useRef(movies);

  const commit = useCallback((updater: (previous: Movie[]) => Movie[]): boolean => {
    const next = updater(moviesRef.current);
    try {
      saveCollection(next);
      moviesRef.current = next;
      setMovies(next);
      setStorageError('');
      return true;
    } catch {
      setStorageError(STORAGE_ERROR);
      return false;
    }
  }, []);

  useEffect(() => {
    return subscribeToCollection(() => {
      try {
        const next = loadCollection();
        moviesRef.current = next;
        setMovies(next);
        setStorageError('');
      } catch {
        setStorageError(STORAGE_ERROR);
      }
    });
  }, []);

  const addMovie = useCallback((movie: Movie) => commit((previous) => [...previous, movie]), [commit]);

  const updateMovie = useCallback(
    (id: string, patch: Partial<Movie>) =>
      commit((previous) => previous.map((movie) => (movie.id === id ? { ...movie, ...patch } : movie))),
    [commit],
  );

  const removeMovie = useCallback(
    (id: string) => commit((previous) => previous.filter((movie) => movie.id !== id)),
    [commit],
  );

  const replaceAll = useCallback((next: Movie[]) => commit(() => next), [commit]);

  const mergeMany = useCallback(
    (incoming: Movie[]) => commit((previous) => mergeMovies(previous, incoming).movies),
    [commit],
  );

  const enrichMovie = useCallback(
    (id: string, patch: Partial<Pick<Movie, 'runtime' | 'genres' | 'posterPath' | 'releaseDate'>>) => {
      commit((previous) => previous.map((movie) => (movie.id === id ? { ...movie, ...patch } : movie)));
    },
    [commit],
  );

  const findById = useCallback((id: string) => findMovieById(moviesRef.current, id), []);

  return {
    movies,
    storageError,
    addMovie,
    updateMovie,
    removeMovie,
    replaceAll,
    mergeMany,
    enrichMovie,
    findById,
  };
}
