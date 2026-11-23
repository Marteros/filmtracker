import { useId, type KeyboardEvent } from 'react';
import type { MovieRating } from '../types';

interface Props { value?: MovieRating; onChange(value?: MovieRating): void; idPrefix?: string }

export function RatingInput({ value, onChange, idPrefix }: Props) {
  const uid = useId();
  const prefix = idPrefix ?? `rating-${uid.replace(/:/g, '')}`;

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, rating: number) {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const next = Math.max(1, Math.min(5, rating + (event.key === 'ArrowRight' ? 1 : -1))) as MovieRating;
    onChange(next);
    document.getElementById(`${prefix}-${next}`)?.focus();
  }

  return (
    <fieldset className="rating-field">
      <legend>Rating</legend>
      <div className="star-picker" role="radiogroup" aria-label="Rating from 1 to 5 stars">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            id={`${prefix}-${rating}`}
            key={rating}
            type="button"
            className={`star-choice${value && rating <= value ? ' selected' : ''}`}
            role="radio"
            aria-checked={value === rating}
            aria-label={`${rating} ${rating === 1 ? 'star' : 'stars'}`}
            tabIndex={value === rating || (!value && rating === 1) ? 0 : -1}
            onClick={() => onChange(rating as MovieRating)}
            onKeyDown={(event) => handleKeyDown(event, rating)}
          >★</button>
        ))}
        {value && <button className="clear-rating" type="button" onClick={() => onChange(undefined)}>Clear</button>}
      </div>
    </fieldset>
  );
}
