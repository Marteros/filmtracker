import type { Movie } from '../types';
import { MovieCard } from './MovieCard';

interface Props {
  movies: Movie[];
  hasMovies: boolean;
  searching: boolean;
  emptyMessage?: string;
  onEdit(movie: Movie): void;
  onDelete(id: string): void;
}

export function MovieGrid({ movies, hasMovies, searching, emptyMessage, onEdit, onDelete }: Props) {
  if (searching) return <div className="empty-state" role="status"><span className="spinner" aria-hidden="true" /><h3>Je collectie laden…</h3></div>;
  if (!movies.length) {
    return <div className="empty-state">
      <p>{emptyMessage || (hasMovies ? 'Geen films' : 'Nog geen films')}</p>
    </div>;
  }
  return <div className="movie-grid" aria-live="polite">{movies.map((movie) => <MovieCard key={movie.id} movie={movie} onEdit={onEdit} onDelete={onDelete} />)}</div>;
}
