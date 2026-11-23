import { useEffect, useRef, useState } from 'react';
import type { Movie } from '@/types';
import { buildSyncedCollection } from '@/services/traktSync';
import { getMovieDetailsCached } from '@/lib/tmdbCache';
import {
  beginTraktAuthorization,
  finishTraktAuthorization,
  getWatchedMovies,
  getWatchlistMovies,
  TRAKT_CLIENT_ID,
  type TraktCredentials,
} from '@/services/trakt';
import { clearTraktSettings, saveTraktSettings } from '@/services/settingsStore';

interface CollectionApi {
  movies: Movie[];
  replaceAll(movies: Movie[]): boolean;
}

export function useTraktSync(collection: CollectionApi) {
  const [trakt, setTrakt] = useState<TraktCredentials>(() => {
    try {
      const raw = localStorage.getItem('frame-trakt-settings-v1');
      if (!raw) return { clientId: '', accessToken: '', refreshToken: '', expiresAt: 0 };
      const saved = JSON.parse(raw) as Partial<TraktCredentials>;
      return {
        clientId: saved.clientId || '',
        accessToken: saved.accessToken || '',
        refreshToken: saved.refreshToken || '',
        expiresAt: saved.expiresAt || 0,
      };
    } catch {
      return { clientId: '', accessToken: '', refreshToken: '', expiresAt: 0 };
    }
  });
  const [traktNotice, setTraktNotice] = useState('');
  const callbackHandled = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const returnedState = params.get('state');
    const authError = params.get('error');
    if ((!code && !authError) || callbackHandled.current) return;
    callbackHandled.current = true;
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    if (authError) {
      setTraktNotice('Trakt sign-in was cancelled. You can start connecting again via Settings.');
      return;
    }
    const clientId = trakt.clientId || TRAKT_CLIENT_ID;
    if (!code || !returnedState || !clientId) {
      setTraktNotice('The Trakt callback is incomplete. Check the Trakt Client ID in the app and try again.');
      return;
    }
    finishTraktAuthorization(clientId, code, returnedState)
      .then((credentials) => {
        saveTraktSettings(credentials);
        setTrakt(credentials);
        setTraktNotice('Trakt is connected. You can now sync your watch history and watchlist.');
      })
      .catch((reason: unknown) => {
        setTraktNotice(reason instanceof Error ? reason.message : 'Could not connect Trakt.');
      });
  }, [trakt.clientId]);

  async function connectTrakt() {
    if (!TRAKT_CLIENT_ID) throw new Error('Trakt is not configured yet. Add a Trakt Client ID in the app code.');
    const next = { clientId: TRAKT_CLIENT_ID, accessToken: '', refreshToken: '', expiresAt: 0 };
    saveTraktSettings(next);
    setTrakt(next);
    const authorizationUrl = await beginTraktAuthorization(TRAKT_CLIENT_ID);
    window.location.assign(authorizationUrl);
  }

  function disconnectTrakt() {
    clearTraktSettings();
    setTrakt({ clientId: '', accessToken: '', refreshToken: '', expiresAt: 0 });
  }

  async function syncTraktMovies(
    onProgress?: (done: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<number> {
    const clientId = trakt.clientId || TRAKT_CLIENT_ID;
    if (!clientId || !trakt.accessToken) throw new Error('Sign in with Trakt first.');
    const effective = { ...trakt, clientId };
    let refreshed: TraktCredentials | null = null;
    const onCredentials = (updated: TraktCredentials) => {
      refreshed = updated;
      saveTraktSettings(updated);
      setTrakt(updated);
    };
    const watched = await getWatchedMovies(effective, onCredentials, signal);
    const watchlist = await getWatchlistMovies(refreshed || effective, onCredentials, signal);
    const result = await buildSyncedCollection(
      { watched, watchlist, current: collection.movies },
      {
        getDetails: getMovieDetailsCached,
        limit: 4,
        onProgress,
        signal,
        onBatch: (batchMovies) => {
          if (!collection.replaceAll(batchMovies)) {
            throw new Error('Sync failed. Check the available storage on this device.');
          }
        },
      },
    );
    if (result.changed && !collection.replaceAll(result.movies)) {
      throw new Error('Sync failed. Check the available storage on this device.');
    }
    return result.changed;
  }

  return { trakt, setTrakt, traktNotice, setTraktNotice, connectTrakt, disconnectTrakt, syncTraktMovies };
}
