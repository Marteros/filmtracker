import { useEffect, useRef, useState } from 'react';
import type { TraktCredentials } from '@/services/trakt';
import type { ThemeMode } from '@/services/theme';
import { useModalScrollLock } from '@/hooks/useModalScrollLock';
import { AppearanceSection } from './AppearanceSection';
import { TraktSection } from './TraktSection';
import { BackupSection, type BackupMode } from './BackupSection';

interface Props {
  open: boolean;
  onClose(): void;
  trakt: TraktCredentials;
  onConnectTrakt(): Promise<void>;
  onDisconnectTrakt(): void;
  onSyncTrakt(onProgress?: (done: number, total: number) => void, signal?: AbortSignal): Promise<number>;
  themeMode: ThemeMode;
  onThemeModeChange(mode: ThemeMode): void;
  onExport(): void;
  onImport(file: File, mode: BackupMode): Promise<string>;
}

export function SettingsDialog({
  open,
  onClose,
  trakt,
  onConnectTrakt,
  onDisconnectTrakt,
  onSyncTrakt,
  themeMode,
  onThemeModeChange,
  onExport,
  onImport,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [resetKey, setResetKey] = useState(0);
  useModalScrollLock(open);

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (open && !element.open) {
      setResetKey((k) => k + 1);
      element.showModal();
    }
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="movie-dialog settings-dialog"
      aria-labelledby="settings-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="settings-shell">
        <div className="dialog-head">
          <h2 id="settings-title">Settings</h2>
          <button type="button" className="close-button" aria-label="Close dialog" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="settings-scroll" key={resetKey}>
          <AppearanceSection themeMode={themeMode} onChange={onThemeModeChange} />
          <TraktSection
            trakt={trakt}
            onConnect={onConnectTrakt}
            onDisconnect={onDisconnectTrakt}
            onSync={onSyncTrakt}
          />
          <BackupSection onExport={onExport} onImport={onImport} />
        </div>
        <div className="settings-footer">
          <button className="save-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
