import type { TmdbCastMember, TmdbMovie } from '@/types';
import { tmdbPoster } from '@/services/tmdb';

interface Props {
  actor: TmdbCastMember;
  movies: TmdbMovie[];
  loading: boolean;
  error: string;
  onClose(): void;
  onOpen(movie: TmdbMovie): void;
}

export function ActorFilmography({ actor, movies, loading, error, onClose, onOpen }: Props) {
  return (
    <div className="actor-filmography" aria-live="polite">
      <div className="actor-filmography-heading">
        <h3>Movies with {actor.name}</h3>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      {loading && <p className="cast-help">Loading movies…</p>}
      {error && (
        <p className="cast-help" role="status">
          {error}
        </p>
      )}
      {!loading && !error && (
        <div className="actor-movie-list">
          {movies.slice(0, 20).map((film) => {
            const filmPoster = tmdbPoster(film.poster_path, 'w185');
            return (
              <button
                className="actor-movie"
                key={film.id}
                type="button"
                aria-label={`Open ${film.title} details`}
                onClick={() => onOpen(film)}
              >
                {filmPoster ? (
                  <img src={filmPoster} alt={`Poster for ${film.title}`} loading="lazy" decoding="async" />
                ) : (
                  <div className="actor-movie-placeholder" aria-hidden="true">
                    {film.title.slice(0, 1)}
                  </div>
                )}
                <span>{film.title}</span>
                {film.release_date && <span>{film.release_date.slice(0, 4)}</span>}
              </button>
            );
          })}
          {!movies.length && <p className="cast-help">No other movies found.</p>}
        </div>
      )}
    </div>
  );
}
