import { useEffect, useMemo, useRef } from 'react';
import type { Movie } from '../types';
import { tmdbPoster } from '../services/tmdb';

interface Props {
  open: boolean;
  movies: Movie[];
  onClose(): void;
  onOpen(movie: Movie): void;
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return undefined;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function AgendaPage({ open, movies, onClose, onOpen }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add('details-open');
    return () => { document.documentElement.classList.remove('details-open'); };
  }, [open]);

  const groups = useMemo(() => {
    const today = startOfDay(new Date());
    const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
    const monthEnd = new Date(today); monthEnd.setMonth(today.getMonth() + 1);
    const watchlist = movies.filter((m) => m.status === 'watchlist');
    const withDate = watchlist
      .map((m) => ({ movie: m, date: parseDate(m.releaseDate) }))
      .filter((item): item is { movie: Movie; date: Date } => Boolean(item.date))
      .sort((a, b) => a.date.getTime() - b.date.getTime() || a.movie.title.localeCompare(b.movie.title, 'nl'));
    const unknown = watchlist
      .filter((m) => !parseDate(m.releaseDate))
      .sort((a, b) => a.title.localeCompare(b.title, 'nl'))
      .map((movie) => ({ movie, date: undefined as Date | undefined }));

    const buckets = {
      available: [] as Array<{ movie: Movie; date: Date }>,
      week: [] as Array<{ movie: Movie; date: Date }>,
      month: [] as Array<{ movie: Movie; date: Date }>,
      later: [] as Array<{ movie: Movie; date: Date }>,
    };
    for (const item of withDate) {
      const day = startOfDay(item.date);
      if (day < today) buckets.available.push(item);
      else if (day < weekEnd) buckets.week.push(item);
      else if (day < monthEnd) buckets.month.push(item);
      else buckets.later.push(item);
    }
    return [
      { id: 'available', title: 'Nu beschikbaar', items: buckets.available },
      { id: 'week', title: 'Deze week', items: buckets.week },
      { id: 'month', title: 'Deze maand', items: buckets.month },
      { id: 'later', title: 'Later', items: buckets.later },
      { id: 'unknown', title: 'Releasedatum onbekend', items: unknown },
    ].filter((g) => g.items.length);
  }, [movies]);

  const hasAny = movies.some((m) => m.status === 'watchlist');

  function formatDate(date?: Date) {
    if (!date) return '';
    return date.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <dialog
      ref={dialogRef}
      className="details-dialog agenda-dialog"
      aria-labelledby="agenda-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClose={onClose}
    >
      <button className="details-close" type="button" aria-label="Agenda sluiten" onClick={onClose}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      <div className="details-page agenda-page">
        <header className="agenda-header">
          <p className="details-kicker">Agenda</p>
          <h1 id="agenda-title">Binnenkort</h1>
          <p className="agenda-intro">Films op je watchlist op releasedatum.</p>
        </header>
        {!hasAny ? (
          <p className="agenda-empty">Nog geen films op je watchlist.</p>
        ) : !groups.length ? (
          <p className="agenda-empty">Geen geplande releases op je watchlist. Voeg films toe via Ontdekken om releasedata te bewaren.</p>
        ) : (
          <div className="agenda-groups">
            {groups.map((group) => (
              <section key={group.id} className="agenda-group" aria-labelledby={`agenda-${group.id}`}>
                <h2 id={`agenda-${group.id}`}>{group.title}</h2>
                <ul className="agenda-list">
                  {group.items.map(({ movie, date }) => {
                    const poster = tmdbPoster(movie.posterPath, 'w185');
                    return (
                      <li key={movie.id}>
                        <button type="button" className="agenda-item" onClick={() => onOpen(movie)}>
                          {poster ? <img src={poster} alt="" loading="lazy" decoding="async" /> : <span className="agenda-poster-fallback">{movie.title.slice(0, 1)}</span>}
                          <span className="agenda-item-copy">
                            <span className="agenda-item-title">{movie.title}</span>
                            <span className="agenda-item-meta">{date ? <time dateTime={movie.releaseDate}>{formatDate(date)}</time> : 'Releasedatum onbekend'}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}
