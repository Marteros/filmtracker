import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Movie, MovieDraft, MovieRating, TmdbMovie } from '../types';
import { MovieSearchCombobox } from './MovieSearchCombobox';
import { RatingInput } from './RatingInput';

interface Props {
  open: boolean;
  token: string;
  movie?: Movie;
  onClose(): void;
  onSave(draft: MovieDraft): string | null;
}

export function MovieDialog({ open, token, movie, onClose, onSave }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [status, setStatus] = useState<'seen' | 'watchlist'>('watchlist');
  const [rating, setRating] = useState<MovieRating>();
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<TmdbMovie>();
  const [error, setError] = useState('');

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    let focusFrame = 0;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
    if (open) {
      setTitle(movie?.title || ''); setYear(movie?.year || '');
      setStatus(movie?.status || 'watchlist'); setRating(movie?.rating);
      setNote(movie?.note || ''); setError('');
      setSelected(movie?.tmdbId ? { id: movie.tmdbId, title: movie.title, poster_path: movie.posterPath } : undefined);
      focusFrame = requestAnimationFrame(() => titleRef.current?.focus());
    }
    return () => cancelAnimationFrame(focusFrame);
  }, [open, movie]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) { setError('Vul een filmtitel in.'); titleRef.current?.focus(); return; }
    const result = onSave({
      title: cleanTitle, year, status, rating: status === 'seen' ? rating : undefined,
      note: note.trim(), tmdbId: selected?.id, posterPath: selected?.poster_path || undefined,
    });
    if (result) setError(result);
  }

  function chooseMovie(result: TmdbMovie) {
    setSelected(result); setTitle(result.title); setYear(result.release_date?.slice(0, 4) || '');
    setError('');
  }

  return (
    <dialog ref={dialogRef} className="movie-dialog" aria-labelledby="movie-dialog-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={onClose} onClick={(event) => { if (event.target === dialogRef.current) onClose(); }}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="dialog-head">
          <div><h2 id="movie-dialog-title">{movie ? 'Film bewerken' : 'Film toevoegen'}</h2></div>
          <button type="button" className="close-button" aria-label="Venster sluiten" onClick={onClose}>×</button>
        </div>
        <MovieSearchCombobox
          value={title}
          token={token}
          inputRef={titleRef}
          onValueChange={(value) => { setTitle(value); setSelected(undefined); setError(''); }}
          onSelect={chooseMovie}
        />
        <div className="form-row">
          <label className="form-field" htmlFor="movie-year">Jaar
          <input id="movie-year" type="number" min="1888" max="2100" inputMode="numeric" value={year} onChange={(event) => setYear(event.target.value)} />
          </label>
          <label className="form-field" htmlFor="movie-status">Status
            <select id="movie-status" value={status} onChange={(event) => setStatus(event.target.value as 'seen' | 'watchlist')}>
              <option value="watchlist">Wil ik zien</option><option value="seen">Gezien</option>
            </select>
          </label>
        </div>
        {status === 'seen' && <RatingInput value={rating} onChange={setRating} />}
        <label className="form-field" htmlFor="movie-note">Notitie
          <textarea id="movie-note" rows={3} maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <p className="form-error" role="alert">{error}</p>
        <button className="save-button" type="submit">{movie ? 'Bewaar wijzigingen' : 'Bewaar film'}</button>
      </form>
    </dialog>
  );
}
