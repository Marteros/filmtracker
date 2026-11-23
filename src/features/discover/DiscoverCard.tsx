import type { Movie, TmdbMovie } from '@/types';
import { tmdbPoster } from '@/services/tmdb';

interface Props {
  movie: TmdbMovie;
  saved?: Movie;
  onOpen(movie: TmdbMovie): void;
  onAdd(movie: TmdbMovie, status: 'seen' | 'watchlist'): void;
}

export function DiscoverCard({ movie, saved, onOpen, onAdd }: Props) {
  const poster = tmdbPoster(movie.poster_path, 'w342');
  const vote = movie.vote_average?.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const onWatchlist = saved?.status === 'watchlist';
  const isSeen = saved?.status === 'seen';
  const watchlistLabel = isSeen
    ? `${movie.title} is already seen`
    : onWatchlist
      ? `${movie.title} is on your watchlist`
      : `Add ${movie.title} to your watchlist`;
  const seenLabel = isSeen ? `${movie.title} is seen` : `Mark ${movie.title} as seen`;
  const bookmarkIcon = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" />
    </svg>
  );
  const eyeIcon = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  return (
    <article className="discover-card">
      <div className="discover-poster">
        <span className="discover-poster-fallback" aria-hidden="true">
          {movie.title.slice(0, 1)}
        </span>
        {poster && (
          <img src={poster} alt="" loading="lazy" decoding="async" onError={(event) => event.currentTarget.remove()} />
        )}
        <button
          className="discover-poster-open"
          type="button"
          onClick={() => onOpen(movie)}
          aria-label={`View details for ${movie.title}`}
        >
          <span className="discover-poster-hint">View details</span>
        </button>
        <div className="discover-poster-actions">
          {!isSeen && (
            <button
              className={`discover-poster-action${onWatchlist ? ' saved' : ''}`}
              type="button"
              aria-label={watchlistLabel}
              title={onWatchlist ? 'On watchlist' : 'Add to watchlist'}
              disabled={Boolean(saved)}
              onClick={() => onAdd(movie, 'watchlist')}
            >
              {bookmarkIcon}
            </button>
          )}
          <button
            className={`discover-poster-action${isSeen ? ' saved' : ''}`}
            type="button"
            aria-label={seenLabel}
            title={isSeen ? 'Seen' : 'Mark as seen'}
            disabled={isSeen}
            onClick={() => onAdd(movie, 'seen')}
          >
            {eyeIcon}
          </button>
        </div>
      </div>
      <div className="discover-card-copy">
        <h2>{movie.title}</h2>
        <div className="discover-card-meta">
          <span>{movie.release_date?.slice(0, 4) || 'Movie'}</span>
          {typeof movie.vote_average === 'number' && movie.vote_average > 0 && (
            <span className="discover-rating" aria-label={`TMDb score ${vote} out of 10`}>
              ★ {vote}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
