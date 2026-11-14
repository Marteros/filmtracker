export type MovieStatus = 'seen' | 'watchlist';
export type MovieRating = 1 | 2 | 3 | 4 | 5;

export interface Movie {
  id: string;
  tmdbId?: number;
  title: string;
  year?: string;
  status: MovieStatus;
  rating?: MovieRating;
  note?: string;
  posterPath?: string;
  palette: number;
  addedAt: number;
}

export interface TmdbMovie {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
  overview?: string;
  vote_average?: number;
  genre_ids?: number[];
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbMovieDetails extends TmdbMovie {
  overview?: string;
  tagline?: string;
  runtime?: number | null;
  genres?: Array<{ id: number; name: string }>;
  vote_average?: number;
  backdrop_path?: string | null;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  profile_path?: string | null;
  order: number;
}

export interface MovieDraft {
  title: string;
  year: string;
  status: MovieStatus;
  rating?: MovieRating;
  note: string;
  tmdbId?: number;
  posterPath?: string;
}

export type SearchState = 'idle' | 'loading' | 'success' | 'empty' | 'error' | 'offline' | 'unconfigured';
