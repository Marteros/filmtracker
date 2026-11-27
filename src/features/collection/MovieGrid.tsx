import type { Movie } from '@/types';
import { MovieCard } from './MovieCard';
import { CollectionEmpty } from './CollectionEmpty';

interface Props {
  movies: Movie[];
  collectionHasMovies: boolean;
  emptyMessage?: string;
  view?: 'grid' | 'list';
  onDiscover?(): void;
  onOpenSettings?(): void;
  onEdit(movie: Movie): void;
  onDelete(id: string): void;
  onOpen(movie: Movie): void;
}

export function MovieGrid({
  movies,
  collectionHasMovies,
  emptyMessage,
  view = 'grid',
  onDiscover,
  onOpenSettings,
  onEdit,
  onDelete,
  onOpen,
}: Props) {
  if (!movies.length) {
    if (!collectionHasMovies)
      return <CollectionEmpty onDiscover={onDiscover} onOpenSettings={onOpenSettings} />;
    return (
      <div className="empty-state">
        <p>{emptyMessage || 'No movies'}</p>
      </div>
    );
  }
  return (
    <div className={view === 'list' ? 'movie-list' : 'movie-grid'}>
      {movies.map((movie) => (
        <MovieCard key={movie.id} movie={movie} view={view} onEdit={onEdit} onDelete={onDelete} onOpen={onOpen} />
      ))}
    </div>
  );
}
