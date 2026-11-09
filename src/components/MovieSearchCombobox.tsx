import { useId, useState, type KeyboardEvent, type Ref } from 'react';
import { useMovieSearch } from '../hooks/useMovieSearch';
import { tmdbPoster } from '../services/tmdb';
import type { TmdbMovie } from '../types';

interface Props {
  value: string;
  token: string;
  inputRef?: Ref<HTMLInputElement>;
  onValueChange(value: string): void;
  onSelect(movie: TmdbMovie): void;
}

export function MovieSearchCombobox({ value, token, inputRef, onValueChange, onSelect }: Props) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const { results, state, message } = useMovieSearch(value, token);
  const expanded = focused && (state === 'success' || state === 'empty' || state === 'loading');

  function choose(movie: TmdbMovie) {
    onSelect(movie);
    setFocused(false);
    setActiveIndex(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault(); setFocused(true); setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault(); setActiveIndex((index) => index <= 0 ? results.length - 1 : index - 1);
    } else if (event.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault(); choose(results[activeIndex]);
    } else if (event.key === 'Escape') {
      setFocused(false); setActiveIndex(-1);
    }
  }

  return (
    <div className="form-field title-field">
      <label htmlFor={`${id}-input`}>Filmtitel <span className="required">*</span></label>
      <input
        ref={inputRef}
        id={`${id}-input`}
        name="title"
        maxLength={80}
        required
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        value={value}
        onChange={(event) => { onValueChange(event.target.value); setFocused(true); setActiveIndex(-1); }}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node)) {
            // iOS Safari can blur the input before dispatching the tapped
            // option's click. Keep the list mounted long enough for that click.
            window.setTimeout(() => setFocused(false), 250);
          }
        }}
        onKeyDown={onKeyDown}
      />
      {focused && (state === 'success' || state === 'empty' || state === 'loading') && (
        <div id={`${id}-listbox`} className="suggestions" role="listbox" aria-label="Filmsuggesties">
          {state === 'loading' && <div className="suggestion-status"><span className="spinner" aria-hidden="true" /> Films zoeken…</div>}
          {state === 'empty' && <div className="suggestion-status">Geen resultaten</div>}
          {results.map((movie, index) => {
            const year = movie.release_date?.slice(0, 4);
            const poster = tmdbPoster(movie.poster_path, 'w92');
            return (
              <button
                id={`${id}-option-${index}`}
                key={movie.id}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                className={`suggestion-item${activeIndex === index ? ' highlighted' : ''}`}
                // Select on click, not pointer-down, so touch gestures can scroll
                // the suggestions list without selecting an item accidentally.
                onClick={() => choose(movie)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                {poster ? <img className="suggestion-poster" src={poster} alt="" loading="lazy" /> : <span className="suggestion-poster suggestion-placeholder" aria-hidden="true">▧</span>}
                <span className="suggestion-info"><span className="suggestion-title">{movie.title}</span><span className="suggestion-meta">{year ? `Film · ${year}` : 'Film'}</span></span>
              </button>
            );
          })}
        </div>
      )}
      {message && <p className={`suggestion-hint ${state}`} aria-live="polite" role={state === 'error' ? 'alert' : 'status'}>{message}</p>}
    </div>
  );
}
