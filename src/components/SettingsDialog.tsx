import { useEffect, useRef, useState, type FormEvent } from 'react';
import { beginTraktAuthorization, type TraktCredentials } from '../services/trakt';

interface Props {
  open: boolean;
  token: string;
  onClose(): void;
  onSave(token: string): void;
  onRemove(): void;
  trakt: TraktCredentials;
  onSaveTrakt(clientId: string): void;
  onSyncTrakt(): Promise<number>;
}

export function SettingsDialog({ open, token, onClose, onSave, onRemove, trakt, onSaveTrakt, onSyncTrakt }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(token);
  const [error, setError] = useState('');
  const [traktClientId, setTraktClientId] = useState(trakt.clientId);
  const [traktMessage, setTraktMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
    if (open) {
      setValue(token); setError(''); setTraktClientId(trakt.clientId);
      setTraktMessage('');
    }
  }, [open, token, trakt]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = value.trim();
    if (!clean) { setError('Plak eerst je TMDb Read Access Token.'); return; }
    onSave(clean);
  }

  async function startTraktLink() {
    if (!traktClientId.trim()) { setTraktMessage('Vul eerst je Trakt Client ID in.'); return; }
    setBusy(true); setTraktMessage('');
    try {
      const clientId = traktClientId.trim();
      onSaveTrakt(clientId);
      const authorizationUrl = await beginTraktAuthorization(clientId);
      window.location.assign(authorizationUrl);
    } catch (reason) { setTraktMessage(reason instanceof Error ? reason.message : 'Trakt kon niet worden gekoppeld.'); }
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
          <p className="settings-help"><a href="https://trakt.tv/oauth/applications" target="_blank" rel="noreferrer">Trakt API-appgegevens</a></p>
          {!trakt.accessToken && <button className="save-button trakt-action" type="button" disabled={busy} onClick={startTraktLink}>{busy ? 'Bezig…' : 'Trakt-account koppelen'}</button>}
          {trakt.accessToken && <p className="trakt-message" role="status">Trakt is gekoppeld.</p>}
          {trakt.accessToken && <button className="save-button trakt-action" type="button" disabled={busy} onClick={syncTrakt}>{busy ? 'Synchroniseren…' : 'Synchroniseer kijkgeschiedenis'}</button>}
          {traktMessage && <p className="trakt-message" role="status">{traktMessage}</p>}
          <p className="settings-help">Eenrichtingssync: bekeken films worden als Gezien gemarkeerd. Posters worden via TMDb opgehaald als je daar een token voor hebt ingesteld. Je notities en beoordelingen blijven behouden. Er is geen Trakt Client Secret nodig.</p>
        </section>
      </form>
    </dialog>
  );
}
