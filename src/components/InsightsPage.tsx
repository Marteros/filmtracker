import { useMemo } from 'react';
import type { Movie } from '../types';

interface Props {
  movies: Movie[];
  onOpen(movie: Movie): void;
}

function monthKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function InsightsPage({ movies, onOpen }: Props) {
  const stats = useMemo(() => {
    const seen = movies.filter((m) => m.status === 'seen');
    const watchlist = movies.filter((m) => m.status === 'watchlist');
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonthKey = monthKey(now.getTime());

    const ratings = seen.map((m) => m.rating).filter((r): r is 1 | 2 | 3 | 4 | 5 => typeof r === 'number');
    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
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
      const decade = `${start}–${start + 9}`;
      decades.set(decade, (decades.get(decade) || 0) + 1);
    }
    const topDecades = [...decades.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

    const genres = new Map<string, number>();
    let totalRuntime = 0;
    let runtimeCount = 0;
    for (const movie of seen) {
      if (typeof movie.runtime === 'number' && movie.runtime > 0) { totalRuntime += movie.runtime; runtimeCount += 1; }
      for (const g of movie.genres || []) genres.set(g, (genres.get(g) || 0) + 1);
    }
    const topGenres = [...genres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    const recent = [...seen].sort((a, b) => (b.watchedAt || b.addedAt) - (a.watchedAt || a.addedAt)).slice(0, 5);
    const topRated = [...seen].filter((m) => m.rating).sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.watchedAt || b.addedAt) - (a.watchedAt || a.addedAt)).slice(0, 5);

    return { seen, watchlist, seenThisYear, seenThisMonth, avgRating, ratingsCount: ratings.length, ratingDist, months, topDecades, topGenres, totalRuntime, runtimeCount, recent, topRated };
  }, [movies]);

  const maxRating = Math.max(1, ...stats.ratingDist.map((r) => r.count));
  const maxMonth = Math.max(1, ...stats.months.map(([, c]) => c));

  function formatMonth(key: string) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' });
  }

  return (
    <main className="app insights-page">
      <div className="mobile-collection-heading"><h1>Inzichten</h1><span>{stats.seen.length}</span></div>
      <section className="insights-grid" aria-label="Statistieken">
        <article className="insight-card highlight"><h2>Gezien</h2><p className="insight-value">{stats.seen.length}</p><p className="insight-sub">films in totaal</p></article>
        <article className="insight-card"><h2>Kijklijst</h2><p className="insight-value">{stats.watchlist.length}</p><p className="insight-sub">nog te zien</p></article>
        <article className="insight-card"><h2>Dit jaar</h2><p className="insight-value">{stats.seenThisYear}</p><p className="insight-sub">gezien in {new Date().getFullYear()}</p></article>
        <article className="insight-card"><h2>Deze maand</h2><p className="insight-value">{stats.seenThisMonth}</p><p className="insight-sub">gezien</p></article>
        <article className="insight-card"><h2>Gemiddelde</h2><p className="insight-value">{stats.ratingsCount ? stats.avgRating.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–'}</p><p className="insight-sub">{stats.ratingsCount ? `op ${stats.ratingsCount} beoordelingen` : 'nog geen beoordelingen'}</p></article>
        <article className="insight-card"><h2>Kijktijd</h2><p className="insight-value">{stats.runtimeCount ? `${Math.round(stats.totalRuntime / 60)} uur` : '–'}</p><p className="insight-sub">{stats.runtimeCount ? `op basis van ${stats.runtimeCount} films` : 'nog geen speelduurdata'}</p></article>
      </section>

      <section className="insight-section" aria-labelledby="rating-dist-title">
        <h2 id="rating-dist-title">Beoordelingen</h2>
        <div className="rating-bars">
          {stats.ratingDist.slice().reverse().map(({ star, count }) => (
            <div className="rating-bar-row" key={star}><span>{star}★</span><div className="rating-bar"><i style={{ width: `${(count / maxRating) * 100}%` }} /></div><span>{count}</span></div>
          ))}
        </div>
      </section>

      {!!stats.months.length && <section className="insight-section" aria-labelledby="months-title">
        <h2 id="months-title">Gezien per maand</h2>
        <div className="month-bars">
          {stats.months.map(([key, count]) => (
            <div className="month-bar-row" key={key}><span>{formatMonth(key)}</span><div className="rating-bar"><i style={{ width: `${(count / maxMonth) * 100}%` }} /></div><span>{count}</span></div>
          ))}
        </div>
      </section>}

      {!!stats.topDecades.length && <section className="insight-section" aria-labelledby="decades-title">
        <h2 id="decades-title">Release-decennia</h2>
        <div className="insight-chips">{stats.topDecades.map(([label, count]) => <span className="insight-chip" key={label}>{label} <strong>{count}</strong></span>)}</div>
      </section>}

      {!!stats.topGenres.length && <section className="insight-section" aria-labelledby="genres-title">
        <h2 id="genres-title">Genres</h2>
        <div className="insight-chips">{stats.topGenres.map(([label, count]) => <span className="insight-chip" key={label}>{label} <strong>{count}</strong></span>)}</div>
      </section>}

      {!!stats.recent.length && <section className="insight-section" aria-labelledby="recent-title">
        <h2 id="recent-title">Recent gezien</h2>
        <ul className="insight-list">
          {stats.recent.map((movie) => <li key={movie.id}><button type="button" onClick={() => onOpen(movie)}><span>{movie.title}</span><span>{movie.watchedAt ? new Date(movie.watchedAt).toLocaleDateString('nl-NL') : '–'}</span></button></li>)}
        </ul>
      </section>}

      {!stats.seen.length && <p className="insight-empty">Markeer films als gezien om hier je terugblik te zien.</p>}
    </main>
  );
}
