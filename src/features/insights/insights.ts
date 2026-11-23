import type { Movie } from '@/types';
import { monthKey } from '@/lib/dates';

export interface InsightsStats {
  seen: Movie[];
  watchlist: Movie[];
  seenThisYear: number;
  seenThisMonth: number;
  avgRating: number;
  ratingsCount: number;
  ratingDist: { star: number; count: number }[];
  months: [string, number][];
  topDecades: [string, number][];
  topGenres: [string, number][];
  totalRuntime: number;
  runtimeCount: number;
  recent: Movie[];
}

export function computeInsights(movies: Movie[], now = new Date()): InsightsStats {
  const seen = movies.filter((m) => m.status === 'seen');
  const watchlist = movies.filter((m) => m.status === 'watchlist');
  const thisYear = now.getFullYear();
  const thisMonthKey = monthKey(now.getTime());

  const ratings = seen.map((m) => m.rating).filter((r): r is 1 | 2 | 3 | 4 | 5 => typeof r === 'number');
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const ratingDist = [1, 2, 3, 4, 5].map((star) => ({ star, count: ratings.filter((r) => r === star).length }));

  const watchedMonths = new Map<string, number>();
  let seenThisYear = 0;
  let seenThisMonth = 0;
  for (const movie of seen) {
    const ts = movie.watchedAt || movie.addedAt;
    const key = monthKey(ts);
    watchedMonths.set(key, (watchedMonths.get(key) || 0) + 1);
    const d = new Date(ts);
    if (d.getFullYear() === thisYear) seenThisYear += 1;
    if (key === thisMonthKey) seenThisMonth += 1;
  }
  const months = [...watchedMonths.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);

  const decades = new Map<string, number>();
  for (const movie of seen) {
    const y = Number(movie.year);
    if (!y) continue;
    const start = Math.floor(y / 10) * 10;
    decades.set(`${start}–${start + 9}`, (decades.get(`${start}–${start + 9}`) || 0) + 1);
  }
  const topDecades = [...decades.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const genres = new Map<string, number>();
  let totalRuntime = 0;
  let runtimeCount = 0;
  for (const movie of seen) {
    if (typeof movie.runtime === 'number' && movie.runtime > 0) {
      totalRuntime += movie.runtime;
      runtimeCount += 1;
    }
    for (const g of movie.genres || []) genres.set(g, (genres.get(g) || 0) + 1);
  }
  const topGenres = [...genres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const recent = [...seen].sort((a, b) => (b.watchedAt || b.addedAt) - (a.watchedAt || a.addedAt)).slice(0, 5);

  return {
    seen,
    watchlist,
    seenThisYear,
    seenThisMonth,
    avgRating,
    ratingsCount: ratings.length,
    ratingDist,
    months,
    topDecades,
    topGenres,
    totalRuntime,
    runtimeCount,
    recent,
  };
}
