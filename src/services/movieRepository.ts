import type { Movie } from '../types';

const MOVIES_KEY = 'frame-film-journal-v1';
const TOKEN_KEY = 'frame-tmdb-token-v1';
const TRAKT_SETTINGS_KEY = 'frame-trakt-settings-v1';

export interface MovieRepository {
  getAll(): Movie[];
  saveAll(movies: Movie[]): void;
}

function isMovie(value: unknown): value is Movie {
  if (!value || typeof value !== 'object') return false;
  const movie = value as Partial<Movie>;
  return typeof movie.id === 'string'
    && typeof movie.title === 'string'
    && (movie.status === 'seen' || movie.status === 'watchlist')
    && typeof movie.addedAt === 'number';
}

export const movieRepository: MovieRepository = {
  getAll() {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(MOVIES_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(isMovie) : [];
    } catch {
      return [];
    }
  },
  saveAll(movies) {
    localStorage.setItem(MOVIES_KEY, JSON.stringify(movies));
  },
};

export const settingsRepository = {
  getToken: () => {
    try { return localStorage.getItem(TOKEN_KEY) || ''; }
    catch { return ''; }
  },
  saveToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
  getTrakt: () => {
    try {
      const saved = JSON.parse(localStorage.getItem(TRAKT_SETTINGS_KEY) || '{}') as Partial<{ clientId: string; clientSecret: string; accessToken: string; refreshToken: string; expiresAt: number }>;
      const clean = {
        clientId: saved.clientId || '', accessToken: saved.accessToken || '',
        refreshToken: saved.refreshToken || '', expiresAt: saved.expiresAt || 0,
      };
      if (saved.clientSecret) localStorage.setItem(TRAKT_SETTINGS_KEY, JSON.stringify(clean));
      return clean;
    } catch {
      return { clientId: '', accessToken: '', refreshToken: '', expiresAt: 0 };
    }
  },
  saveTrakt: (value: { clientId: string; accessToken: string; refreshToken: string; expiresAt: number }) => localStorage.setItem(TRAKT_SETTINGS_KEY, JSON.stringify(value)),
  clearTrakt: () => localStorage.removeItem(TRAKT_SETTINGS_KEY),
};
