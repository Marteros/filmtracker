import { useEffect, useState } from 'react';
import type { Movie, TmdbMovieDetails } from '../types';
import { getMovieDetails, tmdbPoster } from '../services/tmdb';

interface Props { movie: Movie; token: string; onBack(): void }

export function MovieDetailsPage({ movie, token, onBack }: Props) {
  const [details, setDetails] = useState<TmdbMovieDetails>();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!movie.tmdbId || !token) return;
    const controller = new AbortController();
    getMovieDetails(movie.tmdbId, token, controller.signal)
      .then(setDetails)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== 'AbortError') setError(reason.message);
      });
    return () => controller.abort();
  }, [movie.tmdbId, token]);

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
          <p className="details-kicker">{movie.status === 'seen' ? 'Gezien' : 'Op je kijklijst'}{year ? ` · ${year}` : ''}</p>
          <h1>{movie.title}</h1>
          {details?.tagline && <p className="details-tagline">{details.tagline}</p>}
          <div className="details-facts">
            {details?.runtime ? <span>{Math.floor(details.runtime / 60)} uur {details.runtime % 60} min</span> : null}
            {details?.genres?.map((genre) => <span key={genre.id}>{genre.name}</span>)}
            {details?.vote_average ? <span className="details-vote">★ {details.vote_average.toFixed(1)} / 10</span> : null}
          </div>
          {movie.rating && <p className="details-rating" aria-label={`Jouw beoordeling: ${movie.rating} van 5 sterren`}>{'★'.repeat(movie.rating)}{'☆'.repeat(5 - movie.rating)} <small>Jouw beoordeling</small></p>}
        </div>
      </section>
      <section className="details-description">
        <h2>Over de film</h2>
        <p>{details?.overview || (error ? 'Beschrijving niet beschikbaar.' : movie.tmdbId && token ? 'Filmgegevens laden…' : 'Geen beschrijving beschikbaar voor deze film.')}</p>
        {error && <p className="details-error" role="status">{error}</p>}
        {movie.note && <div className="details-note"><h2>Mijn notitie</h2><p>{movie.note}</p></div>}
      </section>
    </main>
  );
}
