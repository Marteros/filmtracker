import type { Movie } from '../types';

const MOVIES_KEY = 'frame-film-journal-v1';
const TOKEN_KEY = 'frame-tmdb-token-v1';

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
};
