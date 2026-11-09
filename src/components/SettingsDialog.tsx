import { useEffect, useRef, useState, type FormEvent } from 'react';
import { authorizeDevice, requestDeviceCode, type TraktCredentials, type TraktDeviceCode } from '../services/trakt';

interface Props {
  open: boolean;
  token: string;
  onClose(): void;
  onSave(token: string): void;
  onRemove(): void;
  trakt: TraktCredentials;
  onSaveTrakt(clientId: string, clientSecret: string): void;
  onConnectTrakt(accessToken: string): void;
  onSyncTrakt(): Promise<number>;
}

export function SettingsDialog({ open, token, onClose, onSave, onRemove, trakt, onSaveTrakt, onConnectTrakt, onSyncTrakt }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(token);
  const [error, setError] = useState('');
  const [traktClientId, setTraktClientId] = useState(trakt.clientId);
  const [traktClientSecret, setTraktClientSecret] = useState(trakt.clientSecret);
  const [deviceCode, setDeviceCode] = useState<TraktDeviceCode>();
  const [traktMessage, setTraktMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
    if (open) {
      setValue(token); setError(''); setTraktClientId(trakt.clientId);
      setTraktClientSecret(trakt.clientSecret); setTraktMessage(''); setDeviceCode(undefined);
    }
  }, [open, token, trakt]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = value.trim();
    if (!clean) { setError('Plak eerst je TMDb Read Access Token.'); return; }
    onSave(clean);
  }

  async function startTraktLink() {
    if (!traktClientId.trim() || !traktClientSecret.trim()) { setTraktMessage('Vul eerst je Trakt Client ID en Client Secret in.'); return; }
    setBusy(true); setTraktMessage('');
    try {
      onSaveTrakt(traktClientId.trim(), traktClientSecret.trim());
      setDeviceCode(await requestDeviceCode(traktClientId.trim()));
    } catch (reason) { setTraktMessage(reason instanceof Error ? reason.message : 'Trakt kon niet worden gekoppeld.'); }
    finally { setBusy(false); }
  }

  async function confirmTraktLink() {
    if (!deviceCode) return;
    setBusy(true); setTraktMessage('');
    try {
      const accessToken = await authorizeDevice({ ...trakt, clientId: traktClientId.trim(), clientSecret: traktClientSecret.trim() }, deviceCode.device_code);
      onConnectTrakt(accessToken); setDeviceCode(undefined); setTraktMessage('Trakt-account gekoppeld.');
    } catch (reason) { setTraktMessage(reason instanceof Error ? reason.message : 'Trakt-koppeling mislukt.'); }
    finally { setBusy(false); }
  }

  async function syncTrakt() {
    setBusy(true); setTraktMessage('');
    try { const count = await onSyncTrakt(); setTraktMessage(`${count} ${count === 1 ? 'film' : 'films'} nieuw bijgewerkt vanuit Trakt.`); }
    catch (reason) { setTraktMessage(reason instanceof Error ? reason.message : 'Synchroniseren mislukt.'); }
    finally { setBusy(false); }
  }

  return (
    <dialog ref={dialogRef} className="movie-dialog settings-dialog" aria-labelledby="settings-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={onClose} onClick={(event) => { if (event.target === dialogRef.current) onClose(); }}>
      <form onSubmit={submit}>
        <div className="dialog-head"><h2 id="settings-title">TMDb</h2><button type="button" className="close-button" aria-label="Venster sluiten" onClick={onClose}>×</button></div>
        <label className="form-field" htmlFor="tmdb-token">TMDb-token
          <input id="tmdb-token" type="password" autoComplete="off" value={value} onChange={(event) => setValue(event.target.value)} />
        </label>
        <p className="settings-help"><a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">TMDb-token ophalen</a></p>
        <p className="form-error" role="alert">{error}</p>
        <button className="save-button" type="submit">Bewaar token</button>
        {token && <button className="remove-token" type="button" onClick={onRemove}>Token verwijderen</button>}
        <section className="trakt-settings" aria-labelledby="trakt-settings-title">
          <h3 id="trakt-settings-title">Trakt-synchronisatie</h3>
          <label className="form-field" htmlFor="trakt-client-id">Client ID
            <input id="trakt-client-id" autoComplete="off" value={traktClientId} onChange={(event) => setTraktClientId(event.target.value)} />
          </label>
          <label className="form-field" htmlFor="trakt-client-secret">Client Secret
            <input id="trakt-client-secret" type="password" autoComplete="off" value={traktClientSecret} onChange={(event) => setTraktClientSecret(event.target.value)} />
          </label>
          <p className="settings-help"><a href="https://trakt.tv/oauth/applications" target="_blank" rel="noreferrer">Trakt API-appgegevens</a></p>
          {!trakt.accessToken && <button className="save-button trakt-action" type="button" disabled={busy} onClick={startTraktLink}>{busy ? 'Bezig…' : 'Trakt-account koppelen'}</button>}
          {deviceCode && <div className="trakt-device-code">
            <p>Open <a href={deviceCode.verification_url} target="_blank" rel="noreferrer">{deviceCode.verification_url}</a> en voer deze code in:</p>
            <strong>{deviceCode.user_code}</strong>
            <button className="save-button trakt-action" type="button" disabled={busy} onClick={confirmTraktLink}>Ik heb toestemming gegeven</button>
          </div>}
          {trakt.accessToken && <button className="save-button trakt-action" type="button" disabled={busy} onClick={syncTrakt}>{busy ? 'Synchroniseren…' : 'Synchroniseer kijkgeschiedenis'}</button>}
          {traktMessage && <p className="trakt-message" role="status">{traktMessage}</p>}
          <p className="settings-help">Eenrichtingssync: bekeken films worden als Gezien gemarkeerd. Je persoonlijke notities en beoordelingen blijven behouden. De Trakt-sleutel wordt lokaal op dit toestel bewaard.</p>
        </section>
      </form>
    </dialog>
  );
}
