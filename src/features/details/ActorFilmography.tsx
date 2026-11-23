import type { TmdbCastMember, TmdbMovie } from '@/types';
import { tmdbPoster } from '@/services/tmdb';

interface Props {
  actor: TmdbCastMember;
  movies: TmdbMovie[];
  loading: boolean;
  error: string;
  onClose(): void;
}

export function ActorFilmography({ actor, movies, loading, error, onClose }: Props) {
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
              <article className="actor-movie" key={film.id}>
                {filmPoster ? (
                  <img src={filmPoster} alt={`Poster for ${film.title}`} loading="lazy" decoding="async" />
                ) : (
                  <div className="actor-movie-placeholder" aria-hidden="true">
                    {film.title.slice(0, 1)}
                  </div>
                )}
                {film.release_date && <span>{film.release_date.slice(0, 4)}</span>}
              </article>
            );
          })}
          {!movies.length && <p className="cast-help">No other movies found.</p>}
        </div>
      )}
    </div>
  );
}
