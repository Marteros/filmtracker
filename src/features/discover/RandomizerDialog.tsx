import { useEffect, type RefObject } from 'react';
import { useModalScrollLock } from '@/hooks/useModalScrollLock';
import type { Movie, TmdbMovie } from '@/types';
import { MOVIE_GENRES } from './genres';
import { LANGUAGE_OPTIONS } from './languages';
import { DiscoverCard } from './DiscoverCard';
import { findMovie } from '@/lib/movie';

export type PeriodPreset = 'all' | 'classic' | '80s' | '90s' | '2000s' | '2010s' | 'recent';

interface Props {
  dialogRef: RefObject<HTMLDialogElement | null>;
  open: boolean;
  onClose(): void;
  genre: number | 'all';
  onGenreChange(value: number | 'all'): void;
  rating: number | 'all';
  onRatingChange(value: number | 'all'): void;
  period: PeriodPreset;
  onPeriodChange(value: PeriodPreset): void;
  language: string;
  onLanguageChange(value: string): void;
  loading: boolean;
  error: string;
  movie: TmdbMovie | null;
  collection: Movie[];
  onPick(): void;
  onOpenMovie(movie: TmdbMovie): void;
  onAddMovie(movie: TmdbMovie, status: 'seen' | 'watchlist'): void;
}

export function RandomizerDialog({
  dialogRef,
  open,
  onClose,
  genre,
  onGenreChange,
  rating,
  onRatingChange,
  period,
  onPeriodChange,
  language,
  onLanguageChange,
  loading,
  error,
  movie,
  collection,
  onPick,
  onOpenMovie,
  onAddMovie,
}: Props) {
  useModalScrollLock(open);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open, dialogRef]);

  return (
    <dialog
      ref={dialogRef}
      className="movie-dialog randomizer-dialog"
      aria-labelledby="randomizer-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="randomizer-shell">
        <div className="dialog-head">
          <h2 id="randomizer-title">Surprise me</h2>
          <button type="button" className="close-button" aria-label="Close dialog" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="settings-help randomizer-help">Choose a few filters and find your next movie.</p>
        <div className="discover-random-controls">
          <label className="select-control" htmlFor="random-genre">
            <select
              id="random-genre"
              aria-label="Genre"
              value={String(genre)}
              onChange={(event) => onGenreChange(event.target.value === 'all' ? 'all' : Number(event.target.value))}
            >
              <option value="all">All genres</option>
              {MOVIE_GENRES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="select-control" htmlFor="random-rating">
            <select
              id="random-rating"
              aria-label="Rating"
              value={String(rating)}
              onChange={(event) => onRatingChange(event.target.value === 'all' ? 'all' : Number(event.target.value))}
            >
              <option value="all">Any rating</option>
              <option value="6">6+ stars</option>
              <option value="7">7+ stars</option>
              <option value="7.5">7.5+ stars</option>
              <option value="8">8+ stars</option>
            </select>
          </label>
          <label className="select-control" htmlFor="random-period">
            <select
              id="random-period"
              aria-label="Period"
              value={period}
              onChange={(event) => onPeriodChange(event.target.value as PeriodPreset)}
            >
              <option value="all">All years</option>
              <option value="classic">Before 1980</option>
              <option value="80s">1980s</option>
              <option value="90s">1990s</option>
              <option value="2000s">2000–2009</option>
              <option value="2010s">2010–2019</option>
              <option value="recent">2020–now</option>
            </select>
          </label>
          <label className="select-control" htmlFor="random-language">
            <select id="random-language" aria-label="Language" value={language} onChange={(event) => onLanguageChange(event.target.value)}>
              <option value="all">All languages</option>
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <button className="discover-primary discover-random-submit" type="button" onClick={onPick} disabled={loading}>
            {loading ? 'Searching…' : movie ? 'Another one' : 'Get suggestion'}
          </button>
        </div>
        {error && (
          <p className="discover-inline-error" role="alert">
            {error}
          </p>
        )}
        {movie && (
          <div className="discover-random-result" aria-live="polite">
            <DiscoverCard
              movie={movie}
              saved={findMovie(collection, {
                tmdbId: movie.id,
                title: movie.title,
                year: movie.release_date?.slice(0, 4),
              })}
              onOpen={onOpenMovie}
              onAdd={onAddMovie}
            />
          </div>
        )}
      </div>
    </dialog>
  );
}
