import { useEffect, useState } from 'react';
import type { Movie, TmdbCastMember, TmdbMovie, TmdbMovieDetails } from '../types';
import { getActorMovieCredits, getMovieCast, getMovieDetails, tmdbPoster } from '../services/tmdb';

interface Props {
  movie: Movie;
  token: string;
  onBack(): void;
  discoveryPreview?: boolean;
  onAddToWatchlist?(): void;
}

export function MovieDetailsPage({ movie, token, onBack, discoveryPreview = false, onAddToWatchlist }: Props) {
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
    if (!movie.tmdbId || !token) return;
    const controller = new AbortController();
    setCastLoading(true); setCastError('');
    getMovieDetails(movie.tmdbId, token, controller.signal)
      .then(setDetails)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== 'AbortError') setError(reason.message);
      });
    getMovieCast(movie.tmdbId, token, controller.signal)
      .then(setCast)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== 'AbortError') setCastError(reason.message);
      })
      .finally(() => { if (!controller.signal.aborted) setCastLoading(false); });
    return () => controller.abort();
  }, [movie.tmdbId, token]);

  useEffect(() => {
    if (!selectedActor || !token) return;
    const controller = new AbortController();
    setActorMovies([]); setActorMoviesLoading(true); setActorMoviesError('');
    getActorMovieCredits(selectedActor.id, token, controller.signal)
      .then(setActorMovies)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== 'AbortError') setActorMoviesError(reason.message);
      })
      .finally(() => { if (!controller.signal.aborted) setActorMoviesLoading(false); });
    return () => controller.abort();
  }, [selectedActor, token]);

  const backdrop = details?.backdrop_path ? tmdbPoster(details.backdrop_path, 'w780') : undefined;
  const poster = tmdbPoster(movie.posterPath, 'w500');
  const year = details?.release_date?.slice(0, 4) || movie.year;

  return (
    <main className="details-page">
      <button className="details-back" type="button" onClick={onBack}>← Terug naar films</button>
      {backdrop && <div className="details-backdrop" style={{ backgroundImage: `linear-gradient(90deg,#122a3a 5%,#122a3ae6 50%,#122a3a60),url("${backdrop}")` }} />}
      <section className="details-hero">
        <div className="details-poster-wrap">
          {poster ? <img className="details-poster" src={poster} alt={`Poster van ${movie.title}`} /> : <div className="details-poster-placeholder">{movie.title}</div>}
        </div>
        <div className="details-copy">
          <p className="details-kicker">{discoveryPreview ? 'Ontdekt' : movie.status === 'seen' ? 'Gezien' : 'Op je kijklijst'}{year ? ` · ${year}` : ''}</p>
          <h1>{movie.title}</h1>
          {details?.tagline && <p className="details-tagline">{details.tagline}</p>}
          <div className="details-facts">
            {details?.runtime ? <span>{Math.floor(details.runtime / 60)} uur {details.runtime % 60} min</span> : null}
            {details?.genres?.map((genre) => <span key={genre.id}>{genre.name}</span>)}
            {details?.vote_average ? <span className="details-vote">★ {details.vote_average.toFixed(1)} / 10</span> : null}
          </div>
          {movie.rating && <p className="details-rating" aria-label={`Jouw beoordeling: ${movie.rating} van 5 sterren`}>{'★'.repeat(movie.rating)}{'☆'.repeat(5 - movie.rating)} <small>Jouw beoordeling</small></p>}
          {discoveryPreview && <button className="details-add-to-watchlist" type="button" onClick={onAddToWatchlist}>Zet op kijklijst</button>}
        </div>
      </section>
      <section className="details-description">
        <h2>Over de film</h2>
        <p>{details?.overview || (error ? 'Beschrijving niet beschikbaar.' : movie.tmdbId && token ? 'Filmgegevens laden…' : 'Geen beschrijving beschikbaar voor deze film.')}</p>
        {error && <p className="details-error" role="status">{error}</p>}
        {movie.note && <div className="details-note"><h2>Mijn notitie</h2><p>{movie.note}</p></div>}
      </section>
      <section className="cast-section" aria-labelledby="cast-heading">
        <h2 id="cast-heading">Acteurs</h2>
        {!token && <p className="cast-help">Stel je TMDb-token in om acteurs en hun films te bekijken.</p>}
        {token && castError && <p className="cast-help" role="status">{castError}</p>}
        {token && castLoading && <p className="cast-help">Acteurs laden…</p>}
        {token && !castLoading && !cast.length && !castError && <p className="cast-help">Geen acteurs gevonden.</p>}
        {!!cast.length && <div className="cast-list" aria-label="Acteurs in deze film">
          {cast.slice(0, 24).map((actor) => {
            const portrait = tmdbPoster(actor.profile_path, 'w185');
            return <button key={actor.id} className={`cast-person${selectedActor?.id === actor.id ? ' selected' : ''}`} type="button" aria-pressed={selectedActor?.id === actor.id} onClick={() => setSelectedActor(actor)}>
              {portrait ? <img className="cast-portrait" src={portrait} alt="" loading="lazy" /> : <span className="cast-portrait cast-initials" aria-hidden="true">{actor.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}</span>}
              <span className="cast-name">{actor.name}</span>
              {actor.character && <span className="cast-character">{actor.character}</span>}
            </button>;
          })}
        </div>}
        {selectedActor && <div className="actor-filmography" aria-live="polite">
          <div className="actor-filmography-heading"><h3>Films met {selectedActor.name}</h3><button type="button" onClick={() => setSelectedActor(undefined)}>Sluiten</button></div>
          {actorMoviesLoading && <p className="cast-help">Films laden…</p>}
          {actorMoviesError && <p className="cast-help" role="status">{actorMoviesError}</p>}
          {!actorMoviesLoading && !actorMoviesError && <div className="actor-movie-list">
            {actorMovies.slice(0, 20).map((film) => {
              const filmPoster = tmdbPoster(film.poster_path, 'w185');
              return <article className="actor-movie" key={film.id}>
                {filmPoster ? <img src={filmPoster} alt={`Poster van ${film.title}`} loading="lazy" /> : <div className="actor-movie-placeholder" aria-hidden="true">{film.title.slice(0, 1)}</div>}
                {film.release_date && <span>{film.release_date.slice(0, 4)}</span>}
              </article>;
            })}
            {!actorMovies.length && <p className="cast-help">Geen andere films gevonden.</p>}
          </div>}
        </div>}
      </section>
    </main>
  );
}
