import type { Movie } from '../types';
import { MovieCard } from './MovieCard';

interface Props {
  movies: Movie[];
  hasMovies: boolean;
  searching: boolean;
  emptyMessage?: string;
  view?: 'grid' | 'list';
  onAdd?(): void;
  onDiscover?(): void;
  onOpenSettings?(): void;
  onEdit(movie: Movie): void;
  onDelete(id: string): void;
  onOpen(movie: Movie): void;
}

export function MovieGrid({ movies, hasMovies, searching, emptyMessage, view = 'grid', onAdd, onDiscover, onOpenSettings, onEdit, onDelete, onOpen }: Props) {
  if (searching) return <div className="empty-state" role="status"><span className="spinner" aria-hidden="true" /><h3>Je collectie laden…</h3></div>;
  if (!movies.length) {
    if (!hasMovies) {
      const compassIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m15.8 8.2-2.5 5.1-5.1 2.5 2.5-5.1 5.1-2.5Z" /></svg>;
      const bookmarkIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" /></svg>;
      const eyeIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="3" /></svg>;
      const plusIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
      const settingsIcon = <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>;
      return (
        <div className="empty-state onboarding-empty">
          <h3>Nog geen films toegevoegd</h3>
          <p className="onboarding-intro">Zo kun je je collectie vullen:</p>
          <ul className="onboarding-options">
            <li>
              <span className="onboarding-icon">{compassIcon}</span>
              <div className="onboarding-copy">
                <strong>Via Ontdekken</strong>
                <p>Zoek of blader door films en voeg ze direct toe vanaf een poster: <span className="inline-icon">{bookmarkIcon}</span> voor je kijklijst of <span className="inline-icon">{eyeIcon}</span> als gezien.</p>
              </div>
            </li>
            <li>
              <span className="onboarding-icon">{plusIcon}</span>
              <div className="onboarding-copy">
                <strong>Handmatig toevoegen</strong>
                <p>Gebruik <span className="inline-icon">{plusIcon}</span> om zelf een filmtitel te zoeken en op te slaan.</p>
              </div>
            </li>
            <li>
              <span className="onboarding-icon">{settingsIcon}</span>
              <div className="onboarding-copy">
                <strong>Via Trakt synchroniseren</strong>
                <p>Open <span className="inline-icon">{settingsIcon}</span> Instellingen om je Trakt-account te koppelen en je kijkgeschiedenis te importeren als gezien.</p>
              </div>
            </li>
          </ul>
          <div className="onboarding-actions">
            {onDiscover && <button className="discover-primary" type="button" onClick={onDiscover}>Naar Ontdekken</button>}
            {onAdd && <button className="onboarding-secondary" type="button" onClick={onAdd}>Film toevoegen</button>}
            {onOpenSettings && <button className="onboarding-secondary" type="button" onClick={onOpenSettings}>Instellingen</button>}
          </div>
        </div>
      );
    }
    return <div className="empty-state">
      <p>{emptyMessage || 'Geen films'}</p>
    </div>;
  }
  return <div className={view === 'list' ? 'movie-list' : 'movie-grid'} aria-live="polite">{movies.map((movie) => <MovieCard key={movie.id} movie={movie} view={view} onEdit={onEdit} onDelete={onDelete} onOpen={onOpen} />)}</div>;
}
