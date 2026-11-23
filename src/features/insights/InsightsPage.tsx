import { useMemo } from 'react';
import type { Movie } from '@/types';
import { computeInsights } from './insights';

interface Props {
  movies: Movie[];
  onOpen(movie: Movie): void;
}

export function InsightsPage({ movies, onOpen }: Props) {
  const stats = useMemo(() => computeInsights(movies), [movies]);

  const maxRating = Math.max(1, ...stats.ratingDist.map((r) => r.count));
  const maxMonth = Math.max(1, ...stats.months.map(([, c]) => c));

  function formatMonth(key: string) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }

  return (
    <main className="app insights-page">
      <div className="mobile-collection-heading">
        <h1>Insights</h1>
        <span>{stats.seen.length}</span>
      </div>
      <section className="insights-grid" aria-label="Statistics">
        <article className="insight-card highlight">
          <h2>Seen</h2>
          <p className="insight-value">{stats.seen.length}</p>
          <p className="insight-sub">movies total</p>
        </article>
        <article className="insight-card">
          <h2>Watchlist</h2>
          <p className="insight-value">{stats.watchlist.length}</p>
          <p className="insight-sub">still to watch</p>
        </article>
        <article className="insight-card">
          <h2>This year</h2>
          <p className="insight-value">{stats.seenThisYear}</p>
          <p className="insight-sub">seen in {new Date().getFullYear()}</p>
        </article>
        <article className="insight-card">
          <h2>This month</h2>
          <p className="insight-value">{stats.seenThisMonth}</p>
          <p className="insight-sub">seen</p>
        </article>
        <article className="insight-card">
          <h2>Average</h2>
          <p className="insight-value">
            {stats.ratingsCount
              ? stats.avgRating.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
              : '–'}
          </p>
          <p className="insight-sub">{stats.ratingsCount ? `from ${stats.ratingsCount} ratings` : 'no ratings yet'}</p>
        </article>
        <article className="insight-card">
          <h2>Watch time</h2>
          <p className="insight-value">{stats.runtimeCount ? `${Math.round(stats.totalRuntime / 60)} h` : '–'}</p>
          <p className="insight-sub">
            {stats.runtimeCount ? `based on ${stats.runtimeCount} movies` : 'no runtime data yet'}
          </p>
        </article>
      </section>

      <section className="insight-section" aria-labelledby="rating-dist-title">
        <h2 id="rating-dist-title">Ratings</h2>
        <div className="rating-bars">
          {stats.ratingDist
            .slice()
            .reverse()
            .map(({ star, count }) => (
              <div className="rating-bar-row" key={star}>
                <span>{star}★</span>
                <div className="rating-bar">
                  <i style={{ width: `${(count / maxRating) * 100}%` }} />
                </div>
                <span>{count}</span>
              </div>
            ))}
        </div>
      </section>

      {!!stats.months.length && (
        <section className="insight-section" aria-labelledby="months-title">
          <h2 id="months-title">Seen per month</h2>
          <div className="month-bars">
            {stats.months.map(([key, count]) => (
              <div className="month-bar-row" key={key}>
                <span>{formatMonth(key)}</span>
                <div className="rating-bar">
                  <i style={{ width: `${(count / maxMonth) * 100}%` }} />
                </div>
                <span>{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!!stats.topDecades.length && (
        <section className="insight-section" aria-labelledby="decades-title">
          <h2 id="decades-title">Release decades</h2>
          <div className="insight-chips">
            {stats.topDecades.map(([label, count]) => (
              <span className="insight-chip" key={label}>
                {label} <strong>{count}</strong>
              </span>
            ))}
          </div>
        </section>
      )}

      {!!stats.topGenres.length && (
        <section className="insight-section" aria-labelledby="genres-title">
          <h2 id="genres-title">Genres</h2>
          <div className="insight-chips">
            {stats.topGenres.map(([label, count]) => (
              <span className="insight-chip" key={label}>
                {label} <strong>{count}</strong>
              </span>
            ))}
          </div>
        </section>
      )}

      {!!stats.recent.length && (
        <section className="insight-section" aria-labelledby="recent-title">
          <h2 id="recent-title">Recently seen</h2>
          <ul className="insight-list">
            {stats.recent.map((movie) => (
              <li key={movie.id}>
                <button type="button" onClick={() => onOpen(movie)}>
                  <span>{movie.title}</span>
                  <span>{movie.watchedAt ? new Date(movie.watchedAt).toLocaleDateString(undefined) : '–'}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!stats.seen.length && <p className="insight-empty">Mark movies as seen to see your recap here.</p>}
    </main>
  );
}
