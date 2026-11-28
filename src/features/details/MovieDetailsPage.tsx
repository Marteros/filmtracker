import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Movie, MovieRating, TmdbCastMember, TmdbMovie } from '@/types';
import { tmdbPoster } from '@/services/tmdb';
import { shareOrCopyMovie } from '@/services/share';
import { useModalScrollLock } from '@/hooks/useModalScrollLock';
import { RatingInput } from '@/components/ui/RatingInput';
import { readOverlay, writeOverlay } from '@/lib/overlayState';
import { useMovieDetails } from './useMovieDetails';
import { CastSection } from './CastSection';
import { findYoutubeTrailer } from './trailer';

interface Props {
  movie: Movie;
  onClose(): void;
  onCloseAll(): void;
  discoveryPreview?: boolean;
  onSetStatus(status: 'seen' | 'watchlist'): boolean;
  onSetRating(rating?: MovieRating): void;
  onRemove(): boolean;
  onEdit?(movie: Movie): void;
  onEnrich?(id: string, patch: Partial<Pick<Movie, 'runtime' | 'genres' | 'posterPath' | 'releaseDate'>>): void;
  historyActor?: TmdbCastMember;
  onSelectActor(actor?: TmdbCastMember): void;
  onOpenMovie(movie: TmdbMovie): void;
}

export function MovieDetailsPage({
  movie,
  onClose,
  onCloseAll,
  discoveryPreview = false,
  onSetStatus,
  onSetRating,
  onRemove,
  onEdit,
  onEnrich,
  historyActor,
  onSelectActor,
  onOpenMovie,
}: Props) {
  const [statusMessage, setStatusMessage] = useState('');
  const [toast, setToast] = useState('');
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [readyTrailerKey, setReadyTrailerKey] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const trailerFrameRef = useRef<HTMLIFrameElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const scrollSaveTimer = useRef<number | undefined>(undefined);
  const actorAutoScrollId = useRef<number | undefined>(undefined);
  const actorAutoScrollStarted = useRef(false);

  const {
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
  } = useMovieDetails(movie, onEnrich);
  const detailsLoading = Boolean(movie.tmdbId) && !details && !error;

  useEffect(() => setSelectedActor(historyActor), [historyActor, setSelectedActor]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const payload = readOverlay(window.history.state, 'frameDetails');
    const savedScrollTop =
      payload && typeof payload === 'object' && 'scrollTop' in payload && typeof payload.scrollTop === 'number'
        ? payload.scrollTop
        : 0;
    actorAutoScrollId.current = undefined;
    actorAutoScrollStarted.current = false;
    const frame = window.requestAnimationFrame(() => dialog.scrollTo({ top: savedScrollTop }));
    return () => window.cancelAnimationFrame(frame);
  }, [movie.id]);

  useEffect(() => setTrailerOpen(false), [movie.id]);

  const selectedActorId = selectedActor?.id;
  useLayoutEffect(() => {
    if (!selectedActorId || actorAutoScrollId.current !== selectedActorId) return;
    if (actorMoviesLoading) actorAutoScrollStarted.current = true;
    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (dialog) dialog.scrollTo({ top: dialog.scrollHeight, behavior: 'smooth' });
    });
    if (actorAutoScrollStarted.current && !actorMoviesLoading) actorAutoScrollId.current = undefined;
    return () => window.cancelAnimationFrame(frame);
  }, [selectedActorId, actorMoviesLoading, actorMovies.length]);

  useModalScrollLock(true);

  useEffect(() => () => window.clearTimeout(scrollSaveTimer.current), []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCloseEvent = () => onClose();
    dialog.addEventListener('close', onCloseEvent);
    return () => dialog.removeEventListener('close', onCloseEvent);
  }, [onClose]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const backdrop = details?.backdrop_path ? tmdbPoster(details.backdrop_path, 'w780') : undefined;
  const trailer = findYoutubeTrailer(details?.videos?.results);
  const trailerReady = trailer?.key === readyTrailerKey;
  const poster = tmdbPoster(movie.posterPath, 'w500');
  const year = details?.release_date?.slice(0, 4) || movie.year;
  const watchedLabel = movie.watchedAt
    ? new Date(movie.watchedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const runtimeLabel = details?.runtime
    ? details.runtime >= 60
      ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m`
      : `${details.runtime} min`
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

  function showToast(message: string) {
    window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(''), 2500);
  }

  function openTrailer() {
    setTrailerOpen(true);
    trailerFrameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
      'https://www.youtube-nocookie.com',
    );
  }

  function closeTrailer() {
    trailerFrameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: 'stopVideo', args: [] }),
      'https://www.youtube-nocookie.com',
    );
    setTrailerOpen(false);
  }

  function selectActor(actor?: TmdbCastMember) {
    actorAutoScrollId.current = actor?.id;
    actorAutoScrollStarted.current = false;
    setSelectedActor(actor);
    onSelectActor(actor);
  }

  function saveScrollPosition(immediate = false) {
    const dialog = dialogRef.current;
    if (!dialog) return;
    window.clearTimeout(scrollSaveTimer.current);
    const save = () => {
      const payload = readOverlay(window.history.state, 'frameDetails');
      if (!payload || typeof payload !== 'object') return;
      const state = writeOverlay(window.history.state, 'frameDetails', {
        ...payload,
        scrollTop: dialog.scrollTop,
      });
      window.history.replaceState(state, '', window.location.href);
    };
    if (immediate) save();
    else scrollSaveTimer.current = window.setTimeout(save, 150);
  }

  async function onShare() {
    if (!movie.tmdbId) return;
    const result = await shareOrCopyMovie(movie.title, movie.tmdbId);
    if (result === 'copied') showToast('Link copied.');
    else if (result === 'failed') showToast("Couldn't copy the link.");
  }

  const checkIcon = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
  const plusIcon = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );

  return (
    <dialog
      ref={dialogRef}
      className="details-dialog"
      aria-labelledby="details-title"
      onScroll={() => saveScrollPosition()}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        /* history handled by parent */
      }}
    >
      {movie.tmdbId && (
        <button
          className="details-share"
          type="button"
          aria-label={`Share ${movie.title}`}
          title="Share"
          onClick={onShare}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 3v12" />
            <path d="m8 7 4-4 4 4" />
            <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
          </svg>
        </button>
      )}
      <button className="details-close" type="button" aria-label="Close details" onClick={onCloseAll}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
      <div className="details-page">
        {backdrop && (
          <div
            className="details-backdrop"
            style={{ backgroundImage: `linear-gradient(90deg,#122a3a 5%,#122a3ae6 50%,#122a3a60),url("${backdrop}")` }}
          />
        )}
        <section className="details-hero">
          <div className="details-poster-wrap">
            <div className="details-poster-placeholder" aria-hidden="true">
              <span>{movie.title}</span>
            </div>
            {poster && (
              <img
                className="details-poster"
                src={poster}
                alt={`Poster for ${movie.title}`}
                onError={(event) => event.currentTarget.remove()}
              />
            )}
          </div>
          <div className="details-info">
            <div className="details-copy">
              {(discoveryPreview || year) && (
                <p className="details-kicker">
                  {discoveryPreview ? (year ? `Discovered · ${year}` : 'Discovered') : year}
                </p>
              )}
              <h1 id="details-title">{movie.title}</h1>
              {details?.tagline && <p className="details-tagline">{details.tagline}</p>}
              <div className="details-facts">
                {runtimeLabel ? <span>{runtimeLabel}</span> : null}
                {details?.genres?.map((genre) => (
                  <span key={genre.id}>{genre.name}</span>
                ))}
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
                  title={
                    !discoveryPreview && movie.status === 'watchlist' ? 'Remove from collection' : 'Add to watchlist'
                  }
                  onClick={() => toggleStatus('watchlist')}
                >
                  {!discoveryPreview && movie.status === 'watchlist' ? checkIcon : plusIcon}
                  <span>Watchlist</span>
                </button>
              </div>
              {trailer && (
                <>
                  <button
                    className="details-trailer-button"
                    type="button"
                    disabled={!trailerReady}
                    onClick={openTrailer}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m8 5 12 7-12 7V5Z" />
                    </svg>
                    {trailerReady ? 'Watch trailer' : 'Preparing trailer…'}
                  </button>
                  <section
                    className={`details-trailer-player${trailerOpen ? ' open' : ''}`}
                    aria-label={`Trailer for ${movie.title}`}
                    aria-hidden={!trailerOpen}
                    inert={!trailerOpen}
                  >
                    <div className="details-trailer-heading">
                      <h2>Trailer</h2>
                      <button type="button" tabIndex={trailerOpen ? 0 : -1} onClick={closeTrailer}>
                        Close trailer
                      </button>
                    </div>
                    <div className="details-trailer-frame">
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}?autoplay=0&enablejsapi=1&playsinline=0&origin=${encodeURIComponent(window.location.origin)}`}
                        title={`${movie.title} trailer`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                        onLoad={() => setReadyTrailerKey(trailer.key)}
                      />
                    </div>
                  </section>
                </>
              )}
              {!discoveryPreview && movie.status === 'seen' && (
                <div className="details-inline-rating">
                  <RatingInput value={movie.rating} onChange={onSetRating} idPrefix={`details-${movie.id}`} />
                </div>
              )}
              {statusMessage && (
                <p className="details-status-error" role="alert">
                  {statusMessage}
                </p>
              )}
              {!discoveryPreview && onEdit && (
                <button className="details-edit-link" type="button" onClick={() => onEdit(movie)}>
                  Edit
                </button>
              )}
            </div>
          </div>
        </section>
        <section className="details-description">
          <h2>About this movie</h2>
          {detailsLoading ? (
            <div className="details-skeleton" role="status" aria-label="Loading movie details">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <p>
              {details?.overview ||
                (error
                  ? 'Description unavailable.'
                  : movie.tmdbId
                    ? 'Loading movie details…'
                    : 'No description available for this movie.')}
            </p>
          )}
          {error && (
            <p className="details-error" role="status">
              {error}
            </p>
          )}
          {movie.note && (
            <div className="details-note">
              <h2>My note</h2>
              <p>{movie.note}</p>
            </div>
          )}
        </section>
        <CastSection
          cast={cast}
          castError={castError}
          castLoading={castLoading}
          hasTmdbId={Boolean(movie.tmdbId)}
          selectedActor={selectedActor}
          onSelectActor={selectActor}
          actorMovies={actorMovies}
          actorMoviesLoading={actorMoviesLoading}
          actorMoviesError={actorMoviesError}
          onOpenMovie={(film) => {
            actorAutoScrollId.current = undefined;
            actorAutoScrollStarted.current = false;
            saveScrollPosition(true);
            onOpenMovie(film);
            window.requestAnimationFrame(() => dialogRef.current?.scrollTo({ top: 0 }));
          }}
        />
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </dialog>
  );
}
