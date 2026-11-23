import type { TraktCredentials } from './trakt';

const TRAKT_SETTINGS_KEY = 'frame-trakt-settings-v1';
const LEGACY_TOKEN_KEY = 'frame-tmdb-token-v1';

interface StoredTraktSettings {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

const EMPTY: TraktCredentials = { clientId: '', accessToken: '', refreshToken: '', expiresAt: 0 };

export function getTraktSettings(): TraktCredentials {
  try {
    const saved = JSON.parse(localStorage.getItem(TRAKT_SETTINGS_KEY) || '{}') as StoredTraktSettings;
    return {
      clientId: saved.clientId || '',
      accessToken: saved.accessToken || '',
      refreshToken: saved.refreshToken || '',
      expiresAt: saved.expiresAt || 0,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveTraktSettings(value: TraktCredentials): void {
  localStorage.setItem(TRAKT_SETTINGS_KEY, JSON.stringify(value));
}

export function clearTraktSettings(): void {
  localStorage.removeItem(TRAKT_SETTINGS_KEY);
}

/** One-time cleanup of credentials from older versions. */
export function migrateSettings(): void {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    const raw = localStorage.getItem(TRAKT_SETTINGS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as StoredTraktSettings;
    if (saved.clientSecret) {
      const clean: TraktCredentials = {
        clientId: saved.clientId || '',
        accessToken: saved.accessToken || '',
        refreshToken: saved.refreshToken || '',
        expiresAt: saved.expiresAt || 0,
      };
      localStorage.setItem(TRAKT_SETTINGS_KEY, JSON.stringify(clean));
    }
  } catch {
    /* Ignore unavailable or malformed legacy storage. */
  }
}
