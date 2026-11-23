import { useRef, useState } from 'react';
import type { TraktCredentials } from '@/services/trakt';

interface Props {
  trakt: TraktCredentials;
  onConnect(): Promise<void>;
  onDisconnect(): void;
  onSync(onProgress?: (done: number, total: number) => void, signal?: AbortSignal): Promise<number>;
}

export function TraktSection({ trakt, onConnect, onDisconnect, onSync }: Props) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null);
  const syncControllerRef = useRef<AbortController | null>(null);

  async function startTraktLink() {
    setBusy(true);
    setMessage('');
    try {
      await onConnect();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Could not connect Trakt.');
    } finally {
      setBusy(false);
    }
  }

  async function syncTrakt() {
    const controller = new AbortController();
    syncControllerRef.current = controller;
    setBusy(true);
    setMessage('');
    setSyncProgress(null);
    try {
      const count = await onSync((done, total) => setSyncProgress({ done, total }), controller.signal);
      setMessage(
        count > 0
          ? `${count} ${count === 1 ? 'movie' : 'movies'} updated from Trakt (watch history and watchlist).`
          : 'Everything is already in sync (watch history and watchlist).',
      );
    } catch (reason) {
      if (reason instanceof Error && reason.name === 'AbortError') setMessage('Sync cancelled.');
      else setMessage(reason instanceof Error ? reason.message : 'Sync failed.');
    } finally {
      setBusy(false);
      setSyncProgress(null);
      syncControllerRef.current = null;
    }
  }

  function cancelSync() {
    syncControllerRef.current?.abort();
  }

  function disconnectTrakt() {
    if (!window.confirm('Disconnect Trakt on this device?')) return;
    onDisconnect();
    setMessage('Trakt disconnected.');
  }

  return (
    <section className="trakt-settings" aria-labelledby="trakt-settings-title">
      <h3 id="trakt-settings-title">Trakt sync</h3>
      <p className="settings-help">
        Connect Trakt to import your watch history and watchlist. One-way sync: watched movies are marked as Seen and
        watchlist movies as Watchlist; notes and ratings are kept.
      </p>
      <p className="settings-help trakt-notice">Frame uses Trakt but is not endorsed or certified by Trakt.</p>
      {!trakt.accessToken && (
        <button className="save-button trakt-action" type="button" disabled={busy} onClick={startTraktLink}>
          {busy ? 'Working…' : 'Sign in with Trakt'}
        </button>
      )}
      {trakt.accessToken && (
        <p className="trakt-message" role="status">
          Trakt is connected.
        </p>
      )}
      {trakt.accessToken && (
        <button className="save-button trakt-action" type="button" disabled={busy} onClick={syncTrakt}>
          {busy
            ? syncProgress && syncProgress.total > 0
              ? `Syncing ${syncProgress.done} / ${syncProgress.total}…`
              : 'Syncing…'
            : 'Sync with Trakt'}
        </button>
      )}
      {busy && (
        <button className="remove-token trakt-disconnect" type="button" onClick={cancelSync}>
          Cancel sync
        </button>
      )}
      {trakt.accessToken && (
        <button className="remove-token trakt-disconnect" type="button" disabled={busy} onClick={disconnectTrakt}>
          Disconnect
        </button>
      )}
      {message && (
        <p className="trakt-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
