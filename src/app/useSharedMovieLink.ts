import { useEffect, useRef, useState } from 'react';
import { getMovieDetails, TmdbError } from '@/services/tmdb';
import type { TmdbMovie } from '@/types';

export function useSharedMovieLink(onOpen: (movie: TmdbMovie) => void) {
  const [shareNotice, setShareNotice] = useState('');
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has('code') || params.has('error')) return;
    const raw = params.get('movie');
    if (!raw) return;
    const tmdbId = Number(raw);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      return;
    }
    handled.current = true;
    const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
    void (async () => {
      let movie: Awaited<ReturnType<typeof getMovieDetails>> | undefined;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          movie = await getMovieDetails(tmdbId, new AbortController().signal);
          break;
        } catch (error) {
          const network = error instanceof TmdbError && error.kind === 'network';
          if (network && attempt === 0) {
            await wait(500);
            continue;
          }
          setShareNotice(
            network
              ? 'Could not open the shared movie. Check your connection and try again.'
              : 'Could not open the shared movie.',
          );
          return;
        }
      }
      if (!movie) return;
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      setShareNotice('');
      onOpen(movie);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return shareNotice;
}
