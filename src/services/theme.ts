export type ThemeMode = 'system' | 'dark' | 'light';

const THEME_KEY = 'frame-theme-v1';

export function getStoredThemeMode(): ThemeMode {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === 'dark' || value === 'light' || value === 'system') return value;
  } catch {
    /* ignore */
  }
  return 'system';
}

export function saveThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'dark' || mode === 'light') return mode;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(mode: ThemeMode): 'dark' | 'light' {
  const resolved = resolveTheme(mode);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? '#0f171d' : '#e9edf0');
  }
  return resolved;
}
