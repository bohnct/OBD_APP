import { useRef, type PointerEvent } from 'react';

const GAP_MS = 320;
const MAX_DRIFT_PX = 24;

/** Calls `onDoubleTap` on two quick taps in the same spot. Spread the handler on the element. */
export function useDoubleTap(onDoubleTap: () => void) {
  const last = useRef<{ at: number; x: number; y: number } | null>(null);
  return {
    onPointerUp: (e: PointerEvent) => {
      if (e.button !== 0) return;
      const now = performance.now();
      const prev = last.current;
      if (
        prev &&
        now - prev.at < GAP_MS &&
        Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < MAX_DRIFT_PX
      ) {
        last.current = null;
        onDoubleTap();
        return;
      }
      last.current = { at: now, x: e.clientX, y: e.clientY };
    },
  };
}

/** Adds a parameter to the plots and says so. */
export function plotAddedMessage(label: string, added: boolean): string {
  return added ? `${label} added to plots — swipe up to see` : `${label} is already plotted`;
}
