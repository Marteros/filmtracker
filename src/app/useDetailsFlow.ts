import { useCallback, useEffect, useState } from 'react';
import { useHistoryOverlay } from '@/hooks/useHistoryOverlay';
import { readOverlay } from '@/lib/overlayState';
import { findMovie } from '@/lib/movie';
import type { Movie, TmdbMovie } from '@/types';

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

interface CollectionApi {
  movies: Movie[];
  findById(id: string): Movie | undefined;
  addMovie(movie: Movie): boolean;
  updateMovie(id: string, movie: Movie): boolean;
  removeMovie(id: string): boolean;
  enrichMovie(id: string, patch: Partial<Pick<Movie, 'runtime' | 'genres' | 'posterPath' | 'releaseDate'>>): void;
}

type DetailsPayload = { movieId?: string; discovery?: TmdbMovie };

export function useDetailsFlow(collection: CollectionApi) {
  const [selectedMovie, setSelectedMovie] = useState<Movie>();
  const [selectedDiscoveryMovie, setSelectedDiscoveryMovie] = useState<TmdbMovie>();

  const detailsOverlay = useHistoryOverlay<DetailsPayload>({
    key: 'frameDetails',
    onChange: (payload) => {
      if (!payload) {
        setSelectedMovie(undefined);
        setSelectedDiscoveryMovie(undefined);
        return;
      }
      if (payload.discovery) {
        setSelectedDiscoveryMovie(payload.discovery);
        setSelectedMovie({
          id: `discover-${payload.discovery.id}`,
          tmdbId: payload.discovery.id,
          title: payload.discovery.title,
          year: payload.discovery.release_date?.slice(0, 4),
          releaseDate: payload.discovery.release_date || undefined,
          status: 'watchlist',
          posterPath: payload.discovery.poster_path || undefined,
          palette: 0,
          addedAt: Date.now(),
        });
        return;
      }
      if (payload.movieId) {
        const saved = collection.findById(payload.movieId);
        if (saved) {
          setSelectedDiscoveryMovie(undefined);
          setSelectedMovie(saved);
        }
      }
    },
  });

  useEffect(() => {
    const details = readOverlay(window.history.state, 'frameDetails') as DetailsPayload | undefined;
    if (details?.discovery) {
      setSelectedDiscoveryMovie(details.discovery);
      setSelectedMovie({
        id: `discover-${details.discovery.id}`,
        tmdbId: details.discovery.id,
        title: details.discovery.title,
        year: details.discovery.release_date?.slice(0, 4),
        releaseDate: details.discovery.release_date || undefined,
        status: 'watchlist',
        posterPath: details.discovery.poster_path || undefined,
        palette: 0,
        addedAt: Date.now(),
      });
    } else if (details?.movieId) {
      const saved = collection.findById(details.movieId);
      if (saved) {
        setSelectedDiscoveryMovie(undefined);
        setSelectedMovie(saved);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function findSavedMovie(movie: TmdbMovie) {
    const year = movie.release_date?.slice(0, 4);
    return findMovie(collection.movies, { tmdbId: movie.id, title: movie.title, year });
  }

  function openMovie(movie: Movie) {
    setSelectedDiscoveryMovie(undefined);
    setSelectedMovie(movie);
    detailsOverlay.open({ movieId: movie.id });
  }

  function openDiscoveredDetails(movie: TmdbMovie) {
    const saved = findSavedMovie(movie);
    if (saved) {
      setSelectedDiscoveryMovie(undefined);
      setSelectedMovie(saved);
      detailsOverlay.open({ movieId: saved.id });
    } else {
      setSelectedDiscoveryMovie(movie);
      setSelectedMovie({
        id: `discover-${movie.id}`,
        tmdbId: movie.id,
        title: movie.title,
        year: movie.release_date?.slice(0, 4),
        releaseDate: movie.release_date || undefined,
        status: 'watchlist',
        posterPath: movie.poster_path || undefined,
        palette: 0,
        addedAt: Date.now(),
      });
      detailsOverlay.open({ discovery: movie });
    }
  }

  function closeDetails() {
    detailsOverlay.close();
  }

  function saveDiscoveredMovie(movie: TmdbMovie, status: 'seen' | 'watchlist' = 'watchlist'): Movie | undefined {
    const existing = findSavedMovie(movie);
    if (existing) {
      if (status === 'seen' && existing.status === 'watchlist') {
        const updated: Movie = { ...existing, status: 'seen', watchedAt: existing.watchedAt ?? Date.now() };
        return collection.updateMovie(existing.id, updated) ? updated : undefined;
      }
      return existing;
    }
    const saved: Movie = {
      id: createId(),
      tmdbId: movie.id,
      title: movie.title,
      year: movie.release_date?.slice(0, 4),
      releaseDate: movie.release_date || undefined,
      status,
      posterPath: movie.poster_path || undefined,
      palette: Math.floor(Math.random() * 8),
      addedAt: Date.now(),
      watchedAt: status === 'seen' ? Date.now() : undefined,
    };
    return collection.addMovie(saved) ? saved : undefined;
  }

  function setMovieStatusFromDetails(movie: Movie, status: 'seen' | 'watchlist'): boolean {
    if (selectedDiscoveryMovie) {
      const saved = saveDiscoveredMovie(selectedDiscoveryMovie, status);
      if (saved) {
        setSelectedMovie(saved);
        setSelectedDiscoveryMovie(undefined);
      }
      return Boolean(saved);
    }
    const nextMovie: Movie = {
      ...movie,
      status,
      watchedAt: status === 'seen' ? (movie.watchedAt ?? Date.now()) : undefined,
      rating: status === 'seen' ? movie.rating : undefined,
    };
    if (!collection.updateMovie(movie.id, nextMovie)) return false;
    setSelectedMovie(nextMovie);
    return true;
  }

  function setMovieRatingFromDetails(movie: Movie, rating?: Movie['rating']) {
    if (movie.status !== 'seen') return;
    const nextMovie: Movie = { ...movie, rating };
    if (collection.updateMovie(movie.id, nextMovie)) setSelectedMovie(nextMovie);
  }

  function removeMovieFromDetails(id: string): boolean {
    if (!collection.findById(id)) return false;
    return collection.removeMovie(id);
  }

  const enrichMovie = useCallback(
    (id: string, patch: Partial<Pick<Movie, 'runtime' | 'genres' | 'posterPath' | 'releaseDate'>>) => {
      collection.enrichMovie(id, patch);
      setSelectedMovie((current) => (current && current.id === id ? { ...current, ...patch } : current));
    },
    [collection],
  );

  return {
    selectedMovie,
    selectedDiscoveryMovie,
    setSelectedMovie,
    setSelectedDiscoveryMovie,
    openMovie,
    openDiscoveredDetails,
    closeDetails,
    findSavedMovie,
    saveDiscoveredMovie,
    setMovieStatusFromDetails,
    setMovieRatingFromDetails,
    removeMovieFromDetails,
    enrichMovie,
  };
}
