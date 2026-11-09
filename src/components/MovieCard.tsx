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

interface Props { movie: Movie; onEdit(movie: Movie): void; onDelete(id: string): void }

export function MovieCard({ movie, onEdit, onDelete }: Props) {
  const poster = tmdbPoster(movie.posterPath);
  return (
    <article className="movie-card">
      <div className="poster" style={{ '--poster': PALETTES[movie.palette % PALETTES.length] } as CSSProperties}>
        {poster && <img className="poster-image" src={poster} alt={`Poster van ${movie.title}`} loading="lazy" onError={(event) => event.currentTarget.remove()} />}
        <div className="card-actions">
          <button className="card-action" type="button" aria-label={`Bewerk ${movie.title}`} onClick={() => onEdit(movie)}>✎</button>
          <button className="card-action delete" type="button" aria-label={`Verwijder ${movie.title}`} onClick={() => onDelete(movie.id)}>×</button>
        </div>
      </div>
      <div className="card-content">
        <h2 className="card-title">{movie.title}</h2>
        <div className="card-meta">
          <span className={`status-pill${movie.status === 'seen' ? ' seen' : ''}`}>{movie.status === 'seen' ? 'Gezien' : 'Wil ik zien'}</span>
          {movie.status === 'seen' && movie.rating && <span className="card-stars" aria-label={`${movie.rating} van 5 sterren`}>{'★'.repeat(movie.rating)}{'☆'.repeat(5 - movie.rating)}</span>}
        </div>
        {movie.note && <p className="card-note">{movie.note}</p>}
      </div>
    </article>
  );
}
