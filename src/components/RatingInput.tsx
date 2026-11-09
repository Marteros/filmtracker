import type { KeyboardEvent } from 'react';
import type { MovieRating } from '../types';

interface Props { value?: MovieRating; onChange(value?: MovieRating): void }

export function RatingInput({ value, onChange }: Props) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, rating: number) {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const next = Math.max(1, Math.min(5, rating + (event.key === 'ArrowRight' ? 1 : -1))) as MovieRating;
    onChange(next);
    document.getElementById(`rating-${next}`)?.focus();
  }

  return (
    <fieldset className="rating-field">
      <legend>Beoordeling</legend>
      <div className="star-picker" role="radiogroup" aria-label="Beoordeling van 1 tot 5 sterren">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            id={`rating-${rating}`}
            key={rating}
            type="button"
            className={`star-choice${value && rating <= value ? ' selected' : ''}`}
            role="radio"
            aria-checked={value === rating}
            aria-label={`${rating} ${rating === 1 ? 'ster' : 'sterren'}`}
            tabIndex={value === rating || (!value && rating === 1) ? 0 : -1}
            onClick={() => onChange(rating as MovieRating)}
            onKeyDown={(event) => handleKeyDown(event, rating)}
          >★</button>
        ))}
        {value && <button className="clear-rating" type="button" onClick={() => onChange(undefined)}>Wis</button>}
      </div>
    </fieldset>
  );
}
