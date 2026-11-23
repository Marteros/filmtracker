export function getMovieShareUrl(tmdbId: number): string {
  const base = new URL(import.meta.env.BASE_URL, window.location.href);
  base.search = '';
  base.hash = '';
  base.searchParams.set('movie', String(tmdbId));
  return base.toString();
}

export type ShareResult = 'shared' | 'copied' | 'failed' | 'cancelled';

export async function shareOrCopyMovie(title: string, tmdbId: number): Promise<ShareResult> {
  const url = getMovieShareUrl(tmdbId);
  const shareData = { title, text: `Check out ${title} on Frame`, url };

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(shareData);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Fall through to copy if native share fails for another reason.
    }
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return 'copied';
    }
  } catch {
    // Fall through to legacy copy.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok ? 'copied' : 'failed';
  } catch {
    return 'failed';
  }
}
