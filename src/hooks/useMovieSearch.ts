import { useEffect, useState } from 'react';
import { searchMovies, TmdbError } from '../services/tmdb';
import type { SearchState, TmdbMovie } from '../types';

export function useMovieSearch(query: string, token: string) {
  const [results, setResults] = useState<TmdbMovie[]>([]);
  const [state, setState] = useState<SearchState>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setResults([]);
      setState(token ? 'idle' : 'unconfigured');
      setMessage('');
      return;
    }
    if (!token) {
      setResults([]); setState('unconfigured');
      setMessage('TMDb niet ingesteld');
      return;
    }
    if (!navigator.onLine) {
      setResults([]); setState('offline');
      setMessage('Offline');
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setState('loading'); setMessage('Films zoeken…');
      try {
        const movies = await searchMovies(normalized, token, controller.signal);
        setResults(movies.slice(0, 7));
        setState(movies.length ? 'success' : 'empty');
        setMessage('');
      } catch (error) {
        if (controller.signal.aborted) return;
        setResults([]);
        setState(error instanceof TmdbError && error.kind === 'network' && !navigator.onLine ? 'offline' : 'error');
        setMessage(error instanceof Error ? error.message : 'Er ging iets mis bij het zoeken.');
      }
    }, 320);

    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [query, token]);

  return { results, state, message };
}
