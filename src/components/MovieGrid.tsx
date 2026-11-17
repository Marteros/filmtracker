import type { Movie } from '../types';
import { MovieCard } from './MovieCard';

interface Props {
  movies: Movie[];
  hasMovies: boolean;
  searching: boolean;
  emptyMessage?: string;
  view?: 'grid' | 'list';
  onAdd?(): void;
  onEdit(movie: Movie): void;
  onDelete(id: string): void;
  onOpen(movie: Movie): void;
}

export function MovieGrid({ movies, hasMovies, searching, emptyMessage, view = 'grid', onAdd, onEdit, onDelete, onOpen }: Props) {
  if (searching) return <div className="empty-state" role="status"><span className="spinner" aria-hidden="true" /><h3>Je collectie laden…</h3></div>;
  if (!movies.length) {
    return <div className="empty-state">
      <p>{emptyMessage || (hasMovies ? 'Geen films' : 'Nog geen films')}</p>
      {!hasMovies && <p className="empty-state-help">Bewaar wat je zag en wat je nog wilt zien.</p>}
      {!hasMovies && onAdd && <button className="discover-primary" type="button" onClick={onAdd}>Film toevoegen</button>}
    </div>;
  }
  return <div className={view === 'list' ? 'movie-list' : 'movie-grid'} aria-live="polite">{movies.map((movie) => <MovieCard key={movie.id} movie={movie} view={view} onEdit={onEdit} onDelete={onDelete} onOpen={onOpen} />)}</div>;
}
