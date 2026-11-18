import { useEffect, useRef, useState } from 'react';
import type { Movie, MovieRating, TmdbCastMember, TmdbMovie, TmdbMovieDetails } from '../types';
import { getActorMovieCredits, getMovieCast, getMovieDetails, tmdbPoster } from '../services/tmdb';
import { RatingInput } from './RatingInput';

interface Props {
  movie: Movie;
  onClose(): void;
  discoveryPreview?: boolean;
  onSetStatus(status: 'seen' | 'watchlist'): boolean;
  onSetRating(rating?: MovieRating): void;
  onRemove(): boolean;
  onEdit?(movie: Movie): void;
  onEnrich?(id: string, patch: Partial<Pick<Movie, 'runtime' | 'genres' | 'posterPath' | 'releaseDate'>>): void;
}

export function MovieDetailsPage({ movie, onClose, discoveryPreview = false, onSetStatus, onSetRating, onRemove, onEdit, onEnrich }: Props) {
  const [statusMessage, setStatusMessage] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [details, setDetails] = useState<TmdbMovieDetails>();
  const [error, setError] = useState('');
  const [cast, setCast] = useState<TmdbCastMember[]>([]);
  const [castError, setCastError] = useState('');
  const [castLoading, setCastLoading] = useState(false);
  const [selectedActor, setSelectedActor] = useState<TmdbCastMember>();
  const [actorMovies, setActorMovies] = useState<TmdbMovie[]>([]);
  const [actorMoviesLoading, setActorMoviesLoading] = useState(false);
  const [actorMoviesError, setActorMoviesError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add('details-open');
    return () => {
      document.documentElement.classList.remove('details-open');
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCloseEvent = () => onClose();
    dialog.addEventListener('close', onCloseEvent);
    return () => dialog.removeEventListener('close', onCloseEvent);
  }, [onClose]);

  useEffect(() => {
    if (!movie.tmdbId) return;
    const controller = new AbortController();
    setCastLoading(true); setCastError('');
    getMovieDetails(movie.tmdbId, controller.signal)
      .then((data) => {
        setDetails(data);
        const patch: Partial<Pick<Movie, 'runtime' | 'genres' | 'posterPath' | 'releaseDate'>> = {};
        if (!movie.runtime && data.runtime) patch.runtime = data.runtime;
        if (!movie.genres?.length && data.genres?.length) patch.genres = data.genres.map((g) => g.name);
        if (!movie.posterPath && data.poster_path) patch.posterPath = data.poster_path;
        if (!movie.releaseDate && data.release_date) patch.releaseDate = data.release_date;
        if (Object.keys(patch).length) onEnrich?.(movie.id, patch);
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== 'AbortError') setError(reason.message);
      });
    getMovieCast(movie.tmdbId, controller.signal)
      .then(setCast)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== 'AbortError') setCastError(reason.message);
      })
      .finally(() => { if (!controller.signal.aborted) setCastLoading(false); });
    return () => controller.abort();
  }, [movie.tmdbId, movie.id, movie.runtime, movie.genres, movie.posterPath, movie.releaseDate, onEnrich]);

  useEffect(() => {
    if (!selectedActor) return;
    const controller = new AbortController();
    setActorMovies([]); setActorMoviesLoading(true); setActorMoviesError('');
    getActorMovieCredits(selectedActor.id, controller.signal)
      .then(setActorMovies)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== 'AbortError') setActorMoviesError(reason.message);
      })
      .finally(() => { if (!controller.signal.aborted) setActorMoviesLoading(false); });
    return () => controller.abort();
  }, [selectedActor]);

  const backdrop = details?.backdrop_path ? tmdbPoster(details.backdrop_path, 'w780') : undefined;
  const poster = tmdbPoster(movie.posterPath, 'w500');
  const year = details?.release_date?.slice(0, 4) || movie.year;
  const watchedLabel = movie.watchedAt ? new Date(movie.watchedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const runtimeLabel = details?.runtime
    ? (details.runtime >= 60 ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : `${details.runtime} min`)
    : '';
  const voteLabel = details?.vote_average
    ? details.vote_average.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : '';

  function toggleStatus(status: 'seen' | 'watchlist') {
    if (discoveryPreview) {
      if (onSetStatus(status)) setStatusMessage('');
      return;
    }
    const active = movie.status === status;
    if (active) {
      if (!window.confirm(`Remove “${movie.title}” from your collection?`)) return;
      if (onRemove()) onClose();
      return;
    }
    if (onSetStatus(status)) setStatusMessage('');
    else setStatusMessage('Could not save. Check the available storage on this device.');
  }

  const checkIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>;
  const plusIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;

  return (
    <dialog
      ref={dialogRef}
      className="details-dialog"
      aria-labelledby="details-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClose={() => { /* history handled by parent */ }}
    >
      <button className="details-close" type="button" aria-label="Close details" onClick={onClose}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      <div className="details-page">
        {backdrop && <div className="details-backdrop" style={{ backgroundImage: `linear-gradient(90deg,#122a3a 5%,#122a3ae6 50%,#122a3a60),url("${backdrop}")` }} />}
        <section className="details-hero">
          <div className="details-poster-wrap">
            <div className="details-poster-placeholder" aria-hidden="true"><span>{movie.title}</span></div>
            {poster && <img className="details-poster" src={poster} alt={`Poster for ${movie.title}`} onError={(event) => event.currentTarget.remove()} />}
          </div>
          <div className="details-info">
            <div className="details-copy">
              {(discoveryPreview || year) && <p className="details-kicker">{discoveryPreview ? (year ? `Discovered · ${year}` : 'Discovered') : year}</p>}
              <h1 id="details-title">{movie.title}</h1>
              {details?.tagline && <p className="details-tagline">{details.tagline}</p>}
              <div className="details-facts">
                {runtimeLabel ? <span>{runtimeLabel}</span> : null}
                {details?.genres?.map((genre) => <span key={genre.id}>{genre.name}</span>)}
                {voteLabel ? <span className="details-vote">★ {voteLabel} / 10</span> : null}
              </div>
            </div>
            <div className="details-controls">
              {movie.status === 'seen' && watchedLabel && <p className="details-watched">Seen on {watchedLabel}</p>}
              <div className="details-status-actions" role="group" aria-label="List status">
                <button
                  type="button"
                  className={`details-status-button seen${!discoveryPreview && movie.status === 'seen' ? ' active' : ''}`}
                  aria-pressed={!discoveryPreview && movie.status === 'seen'}
                  title={!discoveryPreview && movie.status === 'seen' ? 'Remove from collection' : 'Mark as seen'}
                  onClick={() => toggleStatus('seen')}
                >
                  {!discoveryPreview && movie.status === 'seen' ? checkIcon : plusIcon}
                  <span>Seen</span>
                </button>
                <button
                  type="button"
                  className={`details-status-button watchlist${!discoveryPreview && movie.status === 'watchlist' ? ' active' : ''}`}
                  aria-pressed={!discoveryPreview && movie.status === 'watchlist'}
                  title={!discoveryPreview && movie.status === 'watchlist' ? 'Remove from collection' : 'Add to watchlist'}
                  onClick={() => toggleStatus('watchlist')}
                >
                  {!discoveryPreview && movie.status === 'watchlist' ? checkIcon : plusIcon}
                  <span>Watchlist</span>
                </button>
              </div>
              {!discoveryPreview && movie.status === 'seen' && (
                <div className="details-inline-rating">
                  <RatingInput value={movie.rating} onChange={onSetRating} idPrefix={`details-${movie.id}`} />
                </div>
              )}
              {statusMessage && <p className="details-status-error" role="alert">{statusMessage}</p>}
              {!discoveryPreview && onEdit && <button className="details-edit-link" type="button" onClick={() => onEdit(movie)}>Edit</button>}
            </div>
          </div>
        </section>
        <section className="details-description">
          <h2>About this movie</h2>
          <p>{details?.overview || (error ? 'Description unavailable.' : movie.tmdbId ? 'Loading movie details…' : 'No description available for this movie.')}</p>
          {error && <p className="details-error" role="status">{error}</p>}
          {movie.note && <div className="details-note"><h2>My note</h2><p>{movie.note}</p></div>}
        </section>
        <section className="cast-section" aria-labelledby="cast-heading">
          <h2 id="cast-heading">Cast</h2>
          {castError && <p className="cast-help" role="status">{castError}</p>}
          {castLoading && <p className="cast-help">Loading cast…</p>}
          {!castLoading && !cast.length && !castError && <p className="cast-help">{movie.tmdbId ? 'No cast found.' : 'No cast information available.'}</p>}
          {!!cast.length && <div className="cast-list" aria-label="Cast of this movie">
            {cast.slice(0, 24).map((actor) => {
              const portrait = tmdbPoster(actor.profile_path, 'w185');
              return <button key={actor.id} className={`cast-person${selectedActor?.id === actor.id ? ' selected' : ''}`} type="button" aria-pressed={selectedActor?.id === actor.id} onClick={() => setSelectedActor(actor)}>
                {portrait ? <img className="cast-portrait" src={portrait} alt="" loading="lazy" decoding="async" /> : <span className="cast-portrait cast-initials" aria-hidden="true">{actor.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}</span>}
                <span className="cast-name">{actor.name}</span>
                {actor.character && <span className="cast-character">{actor.character}</span>}
              </button>;
            })}
          </div>}
          {selectedActor && <div className="actor-filmography" aria-live="polite">
            <div className="actor-filmography-heading"><h3>Movies with {selectedActor.name}</h3><button type="button" onClick={() => setSelectedActor(undefined)}>Close</button></div>
            {actorMoviesLoading && <p className="cast-help">Loading movies…</p>}
            {actorMoviesError && <p className="cast-help" role="status">{actorMoviesError}</p>}
            {!actorMoviesLoading && !actorMoviesError && <div className="actor-movie-list">
              {actorMovies.slice(0, 20).map((film) => {
                const filmPoster = tmdbPoster(film.poster_path, 'w185');
                return <article className="actor-movie" key={film.id}>
                  {filmPoster ? <img src={filmPoster} alt={`Poster for ${film.title}`} loading="lazy" decoding="async" /> : <div className="actor-movie-placeholder" aria-hidden="true">{film.title.slice(0, 1)}</div>}
                  {film.release_date && <span>{film.release_date.slice(0, 4)}</span>}
                </article>;
              })}
              {!actorMovies.length && <p className="cast-help">No other movies found.</p>}
            </div>}
          </div>}
        </section>
      </div>
    </dialog>
  );
}
