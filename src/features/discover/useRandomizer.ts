import { useRef, useState } from 'react';
import { useHistoryOverlay } from '@/hooks/useHistoryOverlay';
import { findMovie } from '@/lib/movie';
import { getRandomDiscoveryMovie, type RandomMovieCriteria } from '@/services/tmdb';
import type { Movie, TmdbMovie } from '@/types';
import type { PeriodPreset } from './RandomizerDialog';

function periodToYears(preset: PeriodPreset): Pick<RandomMovieCriteria, 'fromYear' | 'toYear'> {
  if (preset === 'classic') return { toYear: 1979 };
  if (preset === '80s') return { fromYear: 1980, toYear: 1989 };
  if (preset === '90s') return { fromYear: 1990, toYear: 1999 };
  if (preset === '2000s') return { fromYear: 2000, toYear: 2009 };
  if (preset === '2010s') return { fromYear: 2010, toYear: 2019 };
  if (preset === 'recent') return { fromYear: 2020 };
  return {};
}

export function useRandomizer(collection: Movie[]) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [genre, setGenre] = useState<number | 'all'>('all');
  const [rating, setRating] = useState<number | 'all'>('all');
  const [period, setPeriod] = useState<PeriodPreset>('all');
  const [language, setLanguage] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [movie, setMovie] = useState<TmdbMovie | null>(null);
  const [recentIds, setRecentIds] = useState<number[]>([]);

  const overlay = useHistoryOverlay<boolean>({
    key: 'frameRandomizer',
    onChange: (value) => setOpen(Boolean(value)),
  });

  function openDialog() {
    setError('');
    if (open) return;
    setOpen(true);
    overlay.open(true);
  }

  function closeDialog() {
    overlay.close();
  }

  async function pick() {
    setLoading(true);
    setError('');
    try {
      const criteria: RandomMovieCriteria = {
        ...periodToYears(period),
        ...(genre === 'all' ? {} : { genreId: genre }),
        ...(rating === 'all' ? {} : { minRating: rating }),
        ...(language === 'all' ? {} : { originalLanguage: language }),
      };
      const avoidIds = new Set(recentIds);
      let picked = await getRandomDiscoveryMovie(
        criteria,
        (candidate) =>
          Boolean(
            findMovie(collection, {
              tmdbId: candidate.id,
              title: candidate.title,
              year: candidate.release_date?.slice(0, 4),
            }),
          ),
        new AbortController().signal,
        avoidIds,
      );
      if (!picked && avoidIds.size) {
        picked = await getRandomDiscoveryMovie(
          criteria,
          (candidate) =>
            Boolean(
              findMovie(collection, {
                tmdbId: candidate.id,
                title: candidate.title,
                year: candidate.release_date?.slice(0, 4),
              }),
            ),
          new AbortController().signal,
          new Set(),
        );
      }
      setMovie(picked);
      if (picked) setRecentIds((current) => [picked.id, ...current.filter((id) => id !== picked.id)].slice(0, 20));
      else setError('No movie found with these criteria that is not already in your collection. Try broader filters.');
    } catch (reason) {
      setMovie(null);
      setError(reason instanceof Error ? reason.message : 'Could not fetch a random movie.');
    } finally {
      setLoading(false);
    }
  }

  return {
    dialogRef,
    open,
    genre,
    setGenre,
    rating,
    setRating,
    period,
    setPeriod,
    language,
    setLanguage,
    loading,
    error,
    movie,
    openDialog,
    closeDialog,
    pick,
  };
}
