import { useEffect, useRef, useState } from 'react';
import type { Movie, TmdbCastMember, TmdbMovie, TmdbMovieDetails } from '@/types';
import { getActorMovieCredits, getMovieCast } from '@/services/tmdb';
import { getMovieDetailsCached } from '@/lib/tmdbCache';

type EnrichPatch = Partial<Pick<Movie, 'runtime' | 'genres' | 'posterPath' | 'releaseDate'>>;

export function useMovieDetails(movie: Movie, onEnrich?: (id: string, patch: EnrichPatch) => void) {
  const [details, setDetails] = useState<TmdbMovieDetails>();
  const [error, setError] = useState('');
  const [cast, setCast] = useState<TmdbCastMember[]>([]);
  const [castError, setCastError] = useState('');
  const [castLoading, setCastLoading] = useState(false);
  const [selectedActor, setSelectedActor] = useState<TmdbCastMember>();
  const [actorMovies, setActorMovies] = useState<TmdbMovie[]>([]);
  const [actorMoviesLoading, setActorMoviesLoading] = useState(false);
  const [actorMoviesError, setActorMoviesError] = useState('');

  const movieRef = useRef(movie);
  useEffect(() => {
    movieRef.current = movie;
  }, [movie]);

  const onEnrichRef = useRef(onEnrich);
  useEffect(() => {
    onEnrichRef.current = onEnrich;
  }, [onEnrich]);

  useEffect(() => {
    if (!movie.tmdbId) return;
    const controller = new AbortController();
    setCastLoading(true);
    setCastError('');
    setError('');
    getMovieDetailsCached(movie.tmdbId, controller.signal)
      .then((data) => {
        setDetails(data);
        const current = movieRef.current;
        const patch: EnrichPatch = {};
        if (!current.runtime && data.runtime) patch.runtime = data.runtime;
        if (!current.genres?.length && data.genres?.length) patch.genres = data.genres.map((g) => g.name);
        if (!current.posterPath && data.poster_path) patch.posterPath = data.poster_path;
        if (!current.releaseDate && data.release_date) patch.releaseDate = data.release_date;
        if (Object.keys(patch).length) onEnrichRef.current?.(current.id, patch);
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== 'AbortError') setError(reason.message);
      });
    getMovieCast(movie.tmdbId, controller.signal)
      .then(setCast)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== 'AbortError') setCastError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCastLoading(false);
      });
    return () => controller.abort();
  }, [movie.tmdbId]);

  useEffect(() => {
    if (!selectedActor) return;
    const controller = new AbortController();
    setActorMovies([]);
    setActorMoviesLoading(true);
    setActorMoviesError('');
    getActorMovieCredits(selectedActor.id, controller.signal)
      .then(setActorMovies)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== 'AbortError') setActorMoviesError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setActorMoviesLoading(false);
      });
    return () => controller.abort();
  }, [selectedActor]);

  return {
    details,
    error,
    cast,
    castError,
    castLoading,
    selectedActor,
    setSelectedActor,
    actorMovies,
    actorMoviesLoading,
    actorMoviesError,
  };
}
