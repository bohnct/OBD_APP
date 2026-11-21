import { useRef, type PointerEvent } from 'react';

const HOLD_MS = 550;
/** A finger that moves further than this is swiping pages, not holding. */
const MOVE_TOLERANCE_PX = 10;

/**
 * Calls `onLongPress` when a finger or mouse button is held still on the element.
 * Spread the returned handlers on the element.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const cancel = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    origin.current = null;
  };

  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return;
      origin.current = { x: e.clientX, y: e.clientY };
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        cancel();
        if ('vibrate' in navigator) navigator.vibrate(15); // not on iPhone
        onLongPress();
      }, HOLD_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      const start = origin.current;
      if (!start) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
  };
}
