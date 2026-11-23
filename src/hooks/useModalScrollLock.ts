import { useEffect } from 'react';

let locks = 0;

function lock() {
  locks += 1;
  if (locks === 1) document.documentElement.classList.add('modal-open');
}

function unlock() {
  locks = Math.max(0, locks - 1);
  if (locks === 0) document.documentElement.classList.remove('modal-open');
}

/** Lock body scrolling while a modal is open, shared by stacked modals. */
export function useModalScrollLock(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    lock();
    return unlock;
  }, [open]);
}
