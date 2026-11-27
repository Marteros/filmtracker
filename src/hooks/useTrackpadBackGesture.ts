import { useEffect } from 'react';
import { readOverlay } from '@/lib/overlayState';

const HISTORY_OVERLAYS = ['frameDetails', 'frameSettings', 'frameAgenda', 'frameFilters', 'frameMovieDialog'];

export function isBackGestureDelta(deltaX: number, deltaY: number) {
  return deltaX <= -8 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25;
}

function hasOpenOverlay() {
  return HISTORY_OVERLAYS.some((key) => {
    const value = readOverlay(window.history.state, key);
    return value !== undefined && value !== null;
  });
}

function isInHorizontalScroller(target: EventTarget | null) {
  let element = target instanceof HTMLElement ? target : null;
  while (element && element !== document.body) {
    const overflowX = window.getComputedStyle(element).overflowX;
    if ((overflowX === 'auto' || overflowX === 'scroll') && element.scrollWidth > element.clientWidth + 1) {
      return true;
    }
    element = element.parentElement;
  }
  return false;
}

export function useTrackpadBackGesture() {
  useEffect(() => {
    let distance = 0;
    let lastWheelAt = 0;
    let lastBackAt = 0;

    function onWheel(event: WheelEvent) {
      if (window.innerWidth <= 650 || event.ctrlKey || !hasOpenOverlay()) {
        distance = 0;
        return;
      }
      if (isInHorizontalScroller(event.target)) {
        distance = 0;
        return;
      }
      if (!isBackGestureDelta(event.deltaX, event.deltaY)) {
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX) || event.deltaX > 0) distance = 0;
        return;
      }

      if (event.cancelable) event.preventDefault();
      const now = performance.now();
      if (now - lastWheelAt > 160) distance = 0;
      distance += -event.deltaX;
      lastWheelAt = now;

      if (distance < 80 || now - lastBackAt < 800) return;
      distance = 0;
      lastBackAt = now;
      window.history.back();
    }

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);
}
