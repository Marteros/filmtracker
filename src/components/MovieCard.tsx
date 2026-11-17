import type { CSSProperties } from 'react';
import type { Movie } from '../types';
import { tmdbPoster } from '../services/tmdb';

const PALETTES = [
  'linear-gradient(145deg,#486579,#172a35 65%,#10151c)',
  'linear-gradient(145deg,#b17b55,#583d3a 58%,#18191f)',
  'linear-gradient(145deg,#73796b,#3c514b 54%,#171f22)',
  'linear-gradient(145deg,#8d5260,#48323f 58%,#1a1820)',
  'linear-gradient(145deg,#857c54,#514a35 58%,#1b1b19)',
  'linear-gradient(145deg,#52728c,#39425e 58%,#171a24)',
  'linear-gradient(145deg,#9b694e,#65423d 55%,#211a1d)',
  'linear-gradient(145deg,#556d61,#31413b 58%,#151d1c)',
];

function releaseLabel(value?: string) {
  if (!value) return '';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  if (date.getTime() <= Date.now()) return 'Beschikbaar';
  return `Vanaf ${date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`;
}

interface Props { movie: Movie; view?: 'grid' | 'list'; onEdit(movie: Movie): void; onDelete(id: string): void; onOpen(movie: Movie): void }

export function MovieCard({ movie, view = 'grid', onEdit, onDelete, onOpen }: Props) {
  const poster = tmdbPoster(movie.posterPath);
  const release = movie.status === 'watchlist' ? releaseLabel(movie.releaseDate) : '';
  if (view === 'list') {
    return (
      <article className="movie-list-item">
        <button className="movie-list-poster" style={{ '--poster': PALETTES[movie.palette % PALETTES.length] } as CSSProperties} type="button" aria-label={`Bekijk informatie over ${movie.title}`} onClick={() => onOpen(movie)}>
          {poster ? <img src={poster} alt="" loading="lazy" decoding="async" onError={(event) => event.currentTarget.remove()} /> : <span className="movie-list-poster-fallback" aria-hidden="true">{movie.title.slice(0, 1)}</span>}
        </button>
        <button className="movie-list-main" type="button" onClick={() => onOpen(movie)}>
          <span className="movie-list-title">{movie.title}{movie.year ? <span className="movie-list-year"> · {movie.year}</span> : null}</span>
          <span className="movie-list-meta">
            {movie.rating ? <span className="card-stars" aria-label={`${movie.rating} van 5 sterren`}>{'★'.repeat(movie.rating)}{'☆'.repeat(5 - movie.rating)}</span> : null}
            {release ? <span className="card-release">{release}</span> : null}
            {!movie.rating && !release ? <span className="movie-list-placeholder">Film</span> : null}
          </span>
        </button>
        <div className="movie-list-actions">
          <button className="card-action delete" type="button" aria-label={`Verwijder ${movie.title}`} title="Verwijderen" onClick={() => onDelete(movie.id)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>
          </button>
          <button className="card-action" type="button" aria-label={`Bewerk ${movie.title}`} title="Bewerken" onClick={() => onEdit(movie)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /><path d="m13.5 7.5 3 3" /></svg>
          </button>
        </div>
      </article>
    );
  }
  return (
    <article className="movie-card">
      <div className="poster-frame">
        <button className="poster" style={{ '--poster': PALETTES[movie.palette % PALETTES.length] } as CSSProperties} type="button" aria-label={`Bekijk informatie over ${movie.title}`} onClick={() => onOpen(movie)}>
          {poster && <img className="poster-image" src={poster} alt="" loading="lazy" decoding="async" onError={(event) => event.currentTarget.remove()} />}
          <span className="poster-details-hint">Bekijk details</span>
        </button>
        <div className="card-actions">
          <button className="card-action delete" type="button" aria-label={`Verwijder ${movie.title}`} title="Verwijderen" onClick={() => onDelete(movie.id)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>
          </button>
          <button className="card-action" type="button" aria-label={`Bewerk ${movie.title}`} title="Bewerken" onClick={() => onEdit(movie)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /><path d="m13.5 7.5 3 3" /></svg>
          </button>
        </div>
      </div>
      <div className="card-content">
        <div className="card-heading">
          <h2 className="card-title">{movie.title}</h2>
          {movie.year && <span className="card-year">{movie.year}</span>}
        </div>
        {(movie.rating || release) && (
          <div className="card-meta">
            {movie.rating ? (
              <span className="card-stars" aria-label={`${movie.rating} van 5 sterren`}>{'★'.repeat(movie.rating)}{'☆'.repeat(5 - movie.rating)}</span>
            ) : null}
            {release && <span className="card-release">{release}</span>}
          </div>
        )}
        {movie.note && <p className="card-note">{movie.note}</p>}
      </div>
    </article>
  );
}
