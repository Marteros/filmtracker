import type { TmdbCastMember, TmdbMovie } from '@/types';
import { tmdbPoster } from '@/services/tmdb';
import { ActorFilmography } from './ActorFilmography';

interface Props {
  cast: TmdbCastMember[];
  castError: string;
  castLoading: boolean;
  hasTmdbId: boolean;
  selectedActor?: TmdbCastMember;
  onSelectActor(actor: TmdbCastMember | undefined): void;
  actorMovies: TmdbMovie[];
  actorMoviesLoading: boolean;
  actorMoviesError: string;
  onOpenMovie(movie: TmdbMovie): void;
}

export function CastSection({
  cast,
  castError,
  castLoading,
  hasTmdbId,
  selectedActor,
  onSelectActor,
  actorMovies,
  actorMoviesLoading,
  actorMoviesError,
  onOpenMovie,
}: Props) {
  return (
    <section className="cast-section" aria-labelledby="cast-heading">
      <h2 id="cast-heading">Cast</h2>
      {castError && (
        <p className="cast-help" role="status">
          {castError}
        </p>
      )}
      {castLoading && (
        <div className="cast-skeleton" role="status" aria-label="Loading cast">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="cast-skeleton-person" key={index}>
              <span />
              <i />
            </div>
          ))}
        </div>
      )}
      {!castLoading && !cast.length && !castError && (
        <p className="cast-help">{hasTmdbId ? 'No cast found.' : 'No cast information available.'}</p>
      )}
      {!!cast.length && (
        <div className="cast-list" aria-label="Cast of this movie">
          {cast.slice(0, 24).map((actor) => {
            const portrait = tmdbPoster(actor.profile_path, 'w185');
            return (
              <button
                key={actor.id}
                className={`cast-person${selectedActor?.id === actor.id ? ' selected' : ''}`}
                type="button"
                aria-pressed={selectedActor?.id === actor.id}
                onClick={() => onSelectActor(actor)}
              >
                {portrait ? (
                  <img className="cast-portrait" src={portrait} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className="cast-portrait cast-initials" aria-hidden="true">
                    {actor.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join('')}
                  </span>
                )}
                <span className="cast-name">{actor.name}</span>
                {actor.character && <span className="cast-character">{actor.character}</span>}
              </button>
            );
          })}
        </div>
      )}
      {selectedActor && (
        <ActorFilmography
          actor={selectedActor}
          movies={actorMovies}
          loading={actorMoviesLoading}
          error={actorMoviesError}
          onClose={() => onSelectActor(undefined)}
          onOpen={onOpenMovie}
        />
      )}
    </section>
  );
}
