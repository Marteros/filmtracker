import { useEffect, useRef, useState, type FormEvent } from 'react';

interface Props {
  open: boolean;
  token: string;
  onClose(): void;
  onSave(token: string): void;
  onRemove(): void;
}

export function SettingsDialog({ open, token, onClose, onSave, onRemove }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(token);
  const [error, setError] = useState('');

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
    if (open) { setValue(token); setError(''); }
  }, [open, token]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = value.trim();
    if (!clean) { setError('Plak eerst je TMDb Read Access Token.'); return; }
    onSave(clean);
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
      </form>
    </dialog>
  );
}
