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
    } catch (reason) { setTraktMessage(reason instanceof Error ? reason.message : 'Trakt kon niet worden gekoppeld.'); }
    finally { setBusy(false); }
  }

  async function syncTrakt() {
    setBusy(true); setTraktMessage('');
    try {
      const count = await onSyncTrakt();
      setTraktMessage(count > 0
        ? `${count} ${count === 1 ? 'film' : 'films'} bijgewerkt vanuit Trakt (kijkgeschiedenis en kijklijst).`
        : 'Alles is al gesynchroniseerd (kijkgeschiedenis en kijklijst).');
    }
    catch (reason) { setTraktMessage(reason instanceof Error ? reason.message : 'Synchroniseren mislukt.'); }
    finally { setBusy(false); }
  }

  function disconnectTrakt() {
    if (!window.confirm('Trakt-verbinding verbreken op dit toestel?')) return;
    onDisconnectTrakt();
    setTraktMessage('Trakt-verbinding verbroken.');
  }

  function exportBackup() {
    onExport();
    setBackupMessage('Back-up gedownload.');
  }

  function pickImportFile() {
    setBackupMessage('');
    fileRef.current?.click();
  }

  async function handleImportFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (backupMode === 'replace' && !window.confirm('Dit vervangt je huidige collectie. Wil je doorgaan?')) {
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setBackupBusy(true); setBackupMessage('');
    try {
      const message = await onImport(file, backupMode);
      setBackupMessage(message);
    } catch (reason) {
      setBackupMessage(reason instanceof Error ? reason.message : 'Importeren mislukt.');
    } finally {
      setBackupBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <dialog ref={dialogRef} className="movie-dialog settings-dialog" aria-labelledby="settings-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={onClose} onClick={(event) => { if (event.target === dialogRef.current) onClose(); }}>
      <div className="settings-shell">
        <div className="dialog-head"><h2 id="settings-title">Instellingen</h2><button type="button" className="close-button" aria-label="Venster sluiten" onClick={onClose}>×</button></div>
        <div className="settings-scroll">
          <section className="trakt-settings" aria-labelledby="trakt-settings-title">
            <h3 id="trakt-settings-title">Trakt-synchronisatie</h3>
            <p className="settings-help">Koppel Trakt om je kijkgeschiedenis en kijklijst te importeren. Eenrichtingssync: bekeken films worden als Gezien gemarkeerd en watchlist-films als Kijklijst; notities en beoordelingen blijven behouden.</p>
            {!trakt.accessToken && <button className="save-button trakt-action" type="button" disabled={busy} onClick={startTraktLink}>{busy ? 'Bezig…' : 'Inloggen met Trakt'}</button>}
            {trakt.accessToken && <p className="trakt-message" role="status">Trakt is gekoppeld.</p>}
            {trakt.accessToken && <button className="save-button trakt-action" type="button" disabled={busy} onClick={syncTrakt}>{busy ? 'Synchroniseren…' : 'Synchroniseer met Trakt'}</button>}
            {trakt.accessToken && <button className="remove-token trakt-disconnect" type="button" disabled={busy} onClick={disconnectTrakt}>Ontkoppelen</button>}
            {traktMessage && <p className="trakt-message" role="status">{traktMessage}</p>}
          </section>
          <section className="backup-settings" aria-labelledby="backup-settings-title">
            <h3 id="backup-settings-title">Gegevens &amp; back-up</h3>
            <div className="backup-actions">
              <button className="save-button" type="button" onClick={exportBackup}>Exporteer</button>
              <button className="save-button" type="button" disabled={backupBusy} onClick={pickImportFile}>{backupBusy ? 'Importeren…' : 'Importeer'}</button>
            </div>
            <label className="backup-mode-control" htmlFor="backup-mode">Bij import
              <select id="backup-mode" value={backupMode} onChange={(event) => setBackupMode(event.target.value as BackupMode)}>
                <option value="merge">Samenvoegen</option>
                <option value="replace">Alles vervangen</option>
              </select>
            </label>
            <input id="backup-file" ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleImportFile} />
            {backupMessage && <p className="trakt-message" role="status">{backupMessage}</p>}
          </section>
        </div>
        <div className="settings-footer"><button className="save-button" type="button" onClick={onClose}>Sluiten</button></div>
      </div>
    </dialog>
  );
}
