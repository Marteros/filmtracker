import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Movie, MovieDraft, MovieRating, TmdbMovie } from '@/types';
import { toDateInput } from '@/lib/dates';
import { MovieSearchCombobox } from '@/components/ui/MovieSearchCombobox';
import { RatingInput } from '@/components/ui/RatingInput';
import { useModalScrollLock } from '@/hooks/useModalScrollLock';

interface Props {
  open: boolean;
  movie?: Movie;
  onClose(): void;
  onSave(draft: MovieDraft): string | null;
}

export function MovieDialog({ open, movie, onClose, onSave }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useModalScrollLock(open);
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [status, setStatus] = useState<'seen' | 'watchlist'>('watchlist');
  const [rating, setRating] = useState<MovieRating>();
  const [watchedAt, setWatchedAt] = useState('');
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<TmdbMovie>();
  const [error, setError] = useState('');

  function todayInput() {
    return toDateInput(Date.now());
  }

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    let focusFrame = 0;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
    if (open) {
      setTitle(movie?.title || '');
      setYear(movie?.year || '');
      setReleaseDate(movie?.releaseDate || '');
      const nextStatus = movie?.status || 'watchlist';
      setStatus(nextStatus);
      setRating(movie?.rating);
      setWatchedAt(nextStatus === 'seen' ? toDateInput(movie?.watchedAt) || todayInput() : '');
      setNote(movie?.note || '');
      setError('');
      setSelected(
        movie?.tmdbId
          ? { id: movie.tmdbId, title: movie.title, poster_path: movie.posterPath, release_date: movie.releaseDate }
          : undefined,
      );
      focusFrame = requestAnimationFrame(() => titleRef.current?.focus());
    }
    return () => cancelAnimationFrame(focusFrame);
  }, [open, movie]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Enter a movie title.');
      titleRef.current?.focus();
      return;
    }
    const result = onSave({
      title: cleanTitle,
      year,
      releaseDate: releaseDate || selected?.release_date || undefined,
      status,
      rating: status === 'seen' ? rating : undefined,
      watchedAt: status === 'seen' ? watchedAt || todayInput() : undefined,
      note: note.trim(),
      tmdbId: selected?.id,
      posterPath: selected?.poster_path || undefined,
    });
    if (result) setError(result);
  }

  function chooseMovie(result: TmdbMovie) {
    setSelected(result);
    setTitle(result.title);
    setYear(result.release_date?.slice(0, 4) || '');
    setReleaseDate(result.release_date || '');
    setError('');
  }

  return (
    <dialog
      ref={dialogRef}
      className="movie-dialog"
      aria-labelledby="movie-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="dialog-head">
          <div>
            <h2 id="movie-dialog-title">{movie ? 'Edit movie' : 'Add movie'}</h2>
          </div>
          <button type="button" className="close-button" aria-label="Close dialog" onClick={onClose}>
            ×
          </button>
        </div>
        <MovieSearchCombobox
          key={`${open ? 'open' : 'closed'}-${movie?.id ?? 'new'}`}
          value={title}
          inputRef={titleRef}
          onValueChange={(value) => {
            setTitle(value);
            setSelected(undefined);
            setError('');
          }}
          onSelect={chooseMovie}
        />
        <div className="form-row">
          <label className="form-field" htmlFor="movie-year">
            Year
            <input
              id="movie-year"
              type="number"
              min="1888"
              max="2100"
              inputMode="numeric"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            />
          </label>
          <label className="form-field" htmlFor="movie-status">
            Status
            <select
              id="movie-status"
              value={status}
              onChange={(event) => {
                const next = event.target.value as 'seen' | 'watchlist';
                setStatus(next);
                if (next === 'seen' && !watchedAt) setWatchedAt(todayInput());
                if (next === 'watchlist') {
                  setRating(undefined);
                  setWatchedAt('');
                }
              }}
            >
              <option value="watchlist">Watchlist</option>
              <option value="seen">Seen</option>
            </select>
          </label>
        </div>
        {status === 'seen' && <RatingInput value={rating} onChange={setRating} />}
        {status === 'seen' && (
          <label className="form-field" htmlFor="movie-watched-at">
            Watched on
            <input
              id="movie-watched-at"
              type="date"
              value={watchedAt}
              onChange={(event) => setWatchedAt(event.target.value)}
            />
          </label>
        )}
        <label className="form-field" htmlFor="movie-note">
          Note
          <textarea
            id="movie-note"
            rows={3}
            maxLength={240}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <p className="form-error" role="alert">
          {error}
        </p>
        <button className="save-button" type="submit">
          {movie ? 'Save changes' : 'Save movie'}
        </button>
      </form>
    </dialog>
  );
}
