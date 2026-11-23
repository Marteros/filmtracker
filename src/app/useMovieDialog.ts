import { useState } from 'react';
import { useHistoryOverlay } from '@/hooks/useHistoryOverlay';
import { parseDateOnly } from '@/lib/dates';
import type { Movie, MovieDraft } from '@/types';

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

interface CollectionApi {
  movies: Movie[];
  addMovie(movie: Movie): boolean;
  updateMovie(id: string, movie: Movie): boolean;
}

export function useMovieDialog(
  collection: CollectionApi,
  selectedMovie: Movie | undefined,
  setSelectedMovie: (movie: Movie) => void,
) {
  const [open, setOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState<Movie>();

  const overlay = useHistoryOverlay<boolean>({
    key: 'frameMovieDialog',
    onChange: (value) => {
      setOpen(Boolean(value));
      if (!value) setEditingMovie(undefined);
    },
  });

  function openDialog(movie?: Movie) {
    setEditingMovie(movie);
    if (open) return;
    setOpen(true);
    overlay.open(true);
  }

  function handleSave(draft: MovieDraft): string | null {
    const duplicate = collection.movies.find((movie) => {
      if (movie.id === editingMovie?.id) return false;
      return (
        (draft.tmdbId && movie.tmdbId === draft.tmdbId) ||
        movie.title.toLocaleLowerCase() === draft.title.toLocaleLowerCase()
      );
    });
    if (duplicate) return `“${duplicate.title}” is already in your collection. You can edit that movie.`;
    const old = editingMovie;
    const watchedAt =
      draft.status === 'seen' ? (parseDateOnly(draft.watchedAt) ?? old?.watchedAt ?? Date.now()) : undefined;
    const nextMovie: Movie = {
      id: old?.id || createId(),
      title: draft.title,
      year: draft.year || undefined,
      releaseDate: draft.releaseDate || old?.releaseDate,
      status: draft.status,
      rating: draft.status === 'seen' ? draft.rating : undefined,
      note: draft.note || undefined,
      tmdbId: draft.tmdbId,
      posterPath: draft.posterPath || old?.posterPath,
      palette: old?.palette ?? Math.floor(Math.random() * 8),
      addedAt: old?.addedAt ?? Date.now(),
      watchedAt,
      runtime: draft.runtime ?? old?.runtime,
      genres: draft.genres ?? old?.genres,
    };
    const saved = old ? collection.updateMovie(old.id, nextMovie) : collection.addMovie(nextMovie);
    if (!saved) return 'Could not save. Check the available storage on this device.';
    if (old && selectedMovie?.id === old.id) setSelectedMovie(nextMovie);
    overlay.close();
    return null;
  }

  return { open, editingMovie, openDialog, closeDialog: overlay.close, handleSave };
}
