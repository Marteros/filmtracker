import { useState } from 'react';
import { findMovie } from '@/lib/movie';
/* discover fetch logic lives in useDiscovery */
import { DiscoverCard } from './DiscoverCard';
import { RandomizerDialog } from './RandomizerDialog';
import { useRandomizer } from './useRandomizer';
import { DISCOVER_SECTIONS, useDiscovery } from './useDiscovery';
import { SearchField } from '@/components/ui/SearchField';
import type { Movie, TmdbMovie } from '@/types';

interface Props {
  collection: Movie[];
  query: string;
  onQueryChange(value: string): void;
  onAdd(movie: TmdbMovie, status: 'seen' | 'watchlist'): boolean;
  onOpen(movie: TmdbMovie): void;
  hidden?: boolean;
}

export function DiscoverPage({ collection, query, onQueryChange, onAdd, onOpen, hidden = false }: Props) {
  const [actionError, setActionError] = useState('');
  const randomizer = useRandomizer(collection);
  const {
    debouncedQuery,
    searchResults,
    feeds,
    selectedSection,
    loading,
    loadingMore,
    hasMore,
    error,
    retry,
    openSection,
    closeSection,
    loadMore,
  } = useDiscovery(query);

  function handleAdd(movie: TmdbMovie, status: 'seen' | 'watchlist') {
    setActionError('');
    if (!onAdd(movie, status)) setActionError('Could not save. Check the available storage on this device.');
  }

  function handleOpenMovie(movie: TmdbMovie) {
    onOpen(movie);
  }

  return (
    <main className="app discover-page" hidden={hidden}>
      <header className={`discover-header${selectedSection ? ' has-section' : ''}`}>
        <h1>
          {selectedSection ? DISCOVER_SECTIONS.find((section) => section.id === selectedSection)?.title : 'Discover'}
        </h1>
        <div className="discover-header-actions">
          {!selectedSection && !debouncedQuery && (
            <button className="discover-random-button" type="button" onClick={randomizer.openDialog}>
              Surprise me
            </button>
          )}
          {selectedSection && (
            <button className="discover-back" type="button" onClick={closeSection}>
              ← Back
            </button>
          )}
        </div>
      </header>

      <RandomizerDialog
        dialogRef={randomizer.dialogRef}
        open={randomizer.open}
        onClose={randomizer.closeDialog}
        genre={randomizer.genre}
        onGenreChange={randomizer.setGenre}
        rating={randomizer.rating}
        onRatingChange={randomizer.setRating}
        period={randomizer.period}
        onPeriodChange={randomizer.setPeriod}
        language={randomizer.language}
        onLanguageChange={randomizer.setLanguage}
        loading={randomizer.loading}
        error={randomizer.error}
        movie={randomizer.movie}
        collection={collection}
        onPick={randomizer.pick}
        onOpenMovie={handleOpenMovie}
        onAddMovie={handleAdd}
      />

      <div className="toolbar discover-toolbar">
        <SearchField
          value={query}
          onChange={onQueryChange}
          label="Search movies to discover"
          placeholder="Search by movie title…"
        />
      </div>
      {actionError && (
        <p className="discover-inline-error" role="alert">
          {actionError}
        </p>
      )}
      {error && (
        <div className="discover-inline-error" role="alert">
          {error}{' '}
          <button type="button" onClick={retry}>
            Try again
          </button>
        </div>
      )}
      {loading ? (
        <div className="discover-grid" role="status" aria-label="Loading movies">
          {Array.from({ length: 8 }, (_, index) => (
            <div className="discover-skeleton" key={index}>
              <span />
              <i />
              <i />
            </div>
          ))}
        </div>
      ) : debouncedQuery ? (
        searchResults.length ? (
          <section className="discover-all-grid" aria-label="Search results">
            {searchResults.map((movie) => (
              <DiscoverCard
                key={movie.id}
                movie={movie}
                saved={findMovie(collection, {
                  tmdbId: movie.id,
                  title: movie.title,
                  year: movie.release_date?.slice(0, 4),
                })}
                onOpen={handleOpenMovie}
                onAdd={handleAdd}
              />
            ))}
          </section>
        ) : (
          !error && (
            <div className="discover-message discover-empty">
              <h2>No movies found</h2>
              <p>Try a different title.</p>
            </div>
          )
        )
      ) : selectedSection ? (
        <>
          <section
            className="discover-all-grid"
            aria-label={`${DISCOVER_SECTIONS.find((section) => section.id === selectedSection)?.title} movies`}
          >
            {(feeds[selectedSection] || []).map((movie) => (
              <DiscoverCard
                key={movie.id}
                movie={movie}
                saved={findMovie(collection, {
                  tmdbId: movie.id,
                  title: movie.title,
                  year: movie.release_date?.slice(0, 4),
                })}
                onOpen={handleOpenMovie}
                onAdd={handleAdd}
              />
            ))}
          </section>
          {!error && hasMore && (
            <button className="discover-load-more" type="button" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more movies'}
            </button>
          )}
        </>
      ) : (
        <div className="discover-sections">
          {DISCOVER_SECTIONS.map(({ id, title }) => (
            <section className="discover-section" key={id} aria-labelledby={`discover-${id}`}>
              <div className="discover-section-heading">
                <h2 id={`discover-${id}`}>{title}</h2>
                <button type="button" onClick={() => openSection(id)}>
                  View all <span aria-hidden="true">→</span>
                </button>
              </div>
              {feeds[id]?.length ? (
                <div className="discover-rail">
                  {feeds[id].slice(0, 12).map((movie) => (
                    <DiscoverCard
                      key={movie.id}
                      movie={movie}
                      saved={findMovie(collection, {
                        tmdbId: movie.id,
                        title: movie.title,
                        year: movie.release_date?.slice(0, 4),
                      })}
                      onOpen={handleOpenMovie}
                      onAdd={handleAdd}
                    />
                  ))}
                </div>
              ) : (
                <div className="discover-rail discover-rail-skeleton" aria-label={`Loading ${title}`} role="status">
                  {Array.from({ length: 5 }, (_, index) => (
                    <div className="discover-skeleton" key={index}>
                      <span />
                      <i />
                      <i />
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
