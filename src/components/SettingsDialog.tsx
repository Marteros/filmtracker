import { useEffect, useRef, useState } from 'react';
import type { TraktCredentials } from '../services/trakt';

type BackupMode = 'merge' | 'replace';

interface Props {
  open: boolean;
  onClose(): void;
  trakt: TraktCredentials;
  onConnectTrakt(): Promise<void>;
  onDisconnectTrakt(): void;
  onSyncTrakt(): Promise<number>;
  onExport(): void;
  onImport(file: File, mode: BackupMode): Promise<string>;
}

export function SettingsDialog({ open, onClose, trakt, onConnectTrakt, onDisconnectTrakt, onSyncTrakt, onExport, onImport }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [traktMessage, setTraktMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [backupMode, setBackupMode] = useState<BackupMode>('merge');
  const [backupMessage, setBackupMessage] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
    if (open) {
      setTraktMessage('');
      setBackupMessage('');
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [open, trakt]);

  async function startTraktLink() {
    setBusy(true); setTraktMessage('');
    try {
      await onConnectTrakt();
    } catch (reason) { setTraktMessage(reason instanceof Error ? reason.message : 'Could not connect Trakt.'); }
    finally { setBusy(false); }
  }

  async function syncTrakt() {
    setBusy(true); setTraktMessage('');
    try {
      const count = await onSyncTrakt();
      setTraktMessage(count > 0
        ? `${count} ${count === 1 ? 'movie' : 'movies'} updated from Trakt (watch history and watchlist).`
        : 'Everything is already in sync (watch history and watchlist).');
    }
    catch (reason) { setTraktMessage(reason instanceof Error ? reason.message : 'Sync failed.'); }
    finally { setBusy(false); }
  }

  function disconnectTrakt() {
    if (!window.confirm('Disconnect Trakt on this device?')) return;
    onDisconnectTrakt();
    setTraktMessage('Trakt disconnected.');
  }

  function exportBackup() {
    onExport();
    setBackupMessage('Backup downloaded.');
  }

  function pickImportFile() {
    setBackupMessage('');
    fileRef.current?.click();
  }

  async function handleImportFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (backupMode === 'replace' && !window.confirm('This will replace your current collection. Do you want to continue?')) {
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setBackupBusy(true); setBackupMessage('');
    try {
      const message = await onImport(file, backupMode);
      setBackupMessage(message);
    } catch (reason) {
      setBackupMessage(reason instanceof Error ? reason.message : 'Import failed.');
    } finally {
      setBackupBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <dialog ref={dialogRef} className="movie-dialog settings-dialog" aria-labelledby="settings-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={onClose} onClick={(event) => { if (event.target === dialogRef.current) onClose(); }}>
      <div className="settings-shell">
        <div className="dialog-head"><h2 id="settings-title">Settings</h2><button type="button" className="close-button" aria-label="Close dialog" onClick={onClose}>×</button></div>
        <div className="settings-scroll">
          <section className="trakt-settings" aria-labelledby="trakt-settings-title">
            <h3 id="trakt-settings-title">Trakt sync</h3>
            <p className="settings-help">Connect Trakt to import your watch history and watchlist. One-way sync: watched movies are marked as Seen and watchlist movies as Watchlist; notes and ratings are kept.</p>
            <p className="settings-help trakt-notice">Frame uses Trakt but is not endorsed or certified by Trakt.</p>
            {!trakt.accessToken && <button className="save-button trakt-action" type="button" disabled={busy} onClick={startTraktLink}>{busy ? 'Working…' : 'Sign in with Trakt'}</button>}
            {trakt.accessToken && <p className="trakt-message" role="status">Trakt is connected.</p>}
            {trakt.accessToken && <button className="save-button trakt-action" type="button" disabled={busy} onClick={syncTrakt}>{busy ? 'Syncing…' : 'Sync with Trakt'}</button>}
            {trakt.accessToken && <button className="remove-token trakt-disconnect" type="button" disabled={busy} onClick={disconnectTrakt}>Disconnect</button>}
            {traktMessage && <p className="trakt-message" role="status">{traktMessage}</p>}
          </section>
          <section className="backup-settings" aria-labelledby="backup-settings-title">
            <h3 id="backup-settings-title">Data &amp; backup</h3>
            <div className="backup-actions">
              <button className="save-button" type="button" onClick={exportBackup}>Export</button>
              <button className="save-button" type="button" disabled={backupBusy} onClick={pickImportFile}>{backupBusy ? 'Importing…' : 'Import'}</button>
            </div>
            <label className="backup-mode-control" htmlFor="backup-mode">On import
              <select id="backup-mode" value={backupMode} onChange={(event) => setBackupMode(event.target.value as BackupMode)}>
                <option value="merge">Merge</option>
                <option value="replace">Replace all</option>
              </select>
            </label>
            <input id="backup-file" ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleImportFile} />
            {backupMessage && <p className="trakt-message" role="status">{backupMessage}</p>}
            <p className="settings-help"><a href="./privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a></p>
          </section>
        </div>
        <div className="settings-footer"><button className="save-button" type="button" onClick={onClose}>Close</button></div>
      </div>
    </dialog>
  );
}
