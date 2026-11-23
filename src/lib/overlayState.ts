export type OverlayState = Record<string, unknown>;

export function readOverlay(state: unknown, key: string): unknown {
  if (!state || typeof state !== 'object') return undefined;
  return (state as OverlayState)[key];
}

export function writeOverlay(state: unknown, key: string, payload: unknown): OverlayState {
  const base = state && typeof state === 'object' ? (state as OverlayState) : {};
  return { ...base, [key]: payload };
}

export function clearOverlay(state: unknown, key: string): OverlayState {
  const base = state && typeof state === 'object' ? { ...(state as OverlayState) } : {};
  delete base[key];
  return base;
}
