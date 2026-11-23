import { useRef, useState } from 'react';

export type BackupMode = 'merge' | 'replace';

interface Props {
  onExport(): void;
  onImport(file: File, mode: BackupMode): Promise<string>;
}

export function BackupSection({ onExport, onImport }: Props) {
  const [backupMode, setBackupMode] = useState<BackupMode>('merge');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function exportBackup() {
    onExport();
    setMessage('Backup downloaded.');
  }

  function pickImportFile() {
    setMessage('');
    fileRef.current?.click();
  }

  async function handleImportFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (
      backupMode === 'replace' &&
      !window.confirm('This will replace your current collection. Do you want to continue?')
    ) {
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      setMessage(await onImport(file, backupMode));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Import failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <section className="backup-settings" aria-labelledby="backup-settings-title">
      <h3 id="backup-settings-title">Data &amp; backup</h3>
      <div className="backup-actions">
        <button className="save-button" type="button" onClick={exportBackup}>
          Export
        </button>
        <button className="save-button" type="button" disabled={busy} onClick={pickImportFile}>
          {busy ? 'Importing…' : 'Import'}
        </button>
      </div>
      <label className="backup-mode-control" htmlFor="backup-mode">
        On import
        <select
          id="backup-mode"
          value={backupMode}
          onChange={(event) => setBackupMode(event.target.value as BackupMode)}
        >
          <option value="merge">Merge</option>
          <option value="replace">Replace all</option>
        </select>
      </label>
      <input
        id="backup-file"
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={handleImportFile}
      />
      {message && (
        <p className="trakt-message" role="status">
          {message}
        </p>
      )}
      <p className="settings-help">
        <a href="./privacy.html" target="_blank" rel="noreferrer">
          Privacy Policy
        </a>
      </p>
    </section>
  );
}
