import { useCallback, useEffect, useRef } from 'react';
import { readOverlay, writeOverlay } from '@/lib/overlayState';

interface Options<T> {
  key: string;
  onChange(value: T | null): void;
  deserialize?(raw: unknown): T | null;
}

/**
 * Keeps an overlay in sync with the browser history.
 *
 * Opening pushes one entry, closing goes back, and popstate restores the
 * overlay from the entry's payload. Each overlay owns its own history key.
 */
export function useHistoryOverlay<T>({ key, onChange, deserialize }: Options<T>) {
  const onChangeRef = useRef(onChange);
  const deserializeRef = useRef(deserialize);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    deserializeRef.current = deserialize;
  }, [deserialize]);

  const open = useCallback(
    (value: T) => {
      const state = writeOverlay(window.history.state, key, value);
      if (readOverlay(window.history.state, key) !== undefined) {
        window.history.replaceState(state, '', window.location.href);
      } else {
        window.history.pushState(state, '', window.location.href);
      }
    },
    [key],
  );

  const close = useCallback(() => {
    if (readOverlay(window.history.state, key) !== undefined) {
      window.history.back();
      return;
    }
    onChangeRef.current(null);
  }, [key]);

  const push = useCallback(
    (value: T) => {
      const state = writeOverlay(window.history.state, key, value);
      window.history.pushState(state, '', window.location.href);
    },
    [key],
  );

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      const raw = readOverlay(event.state, key);
      if (raw === undefined || raw === null) {
        onChangeRef.current(null);
        return;
      }
      const value = deserializeRef.current ? deserializeRef.current(raw) : (raw as T);
      onChangeRef.current(value);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [key]);

  return { open, push, close };
}
