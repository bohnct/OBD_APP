import { useEffect, type RefObject } from 'react';

/** How far a finger must travel up or down to count as a swipe (px). */
const DISTANCE = 70;
/** A swipe must be at least this much more vertical than horizontal. */
const STEEPNESS = 1.5;
/**
 * Touches starting this close to the screen edges (fraction of width / height) are left to
 * the phone: its notification shade and control centre at the top, home bar at the bottom
 * and back gesture at the sides.
 */
const EDGE_X = 0.08;
const EDGE_Y = 0.12;

interface Handlers {
  readonly onSwipeDown: () => void;
  readonly onSwipeUp: () => void;
}

interface Start {
  readonly x: number;
  readonly y: number;
  /** Whether whatever scrolls under the finger was already at its top / bottom. */
  readonly atTop: boolean;
  readonly atBottom: boolean;
}

/**
 * Detects up and down swipes that start away from the screen edges, anywhere inside `ref`.
 * Over something that scrolls (the All data list, the plots, settings), a swipe only counts
 * once that list is already at its end, so ordinary scrolling still works.
 *
 * Touch events are used for fingers because pointer events are cancelled as soon as the
 * browser starts scrolling; a mouse drag works too, for testing on a laptop.
 */
export function useVerticalSwipe(ref: RefObject<HTMLElement | null>, handlers: Handlers): void {
  const { onSwipeDown, onSwipeUp } = handlers;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let start: Start | null = null;

    const begin = (x: number, y: number, target: EventTarget | null) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (x < w * EDGE_X || x > w * (1 - EDGE_X) || y < h * EDGE_Y || y > h * (1 - EDGE_Y)) {
        start = null;
        return;
      }
      const scroller = scrollParent(target, root);
      start = {
        x,
        y,
        atTop: !scroller || scroller.scrollTop <= 1,
        atBottom:
          !scroller || scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1,
      };
    };
    const finish = (x: number, y: number) => {
      const s = start;
      start = null;
      if (!s) return;
      const dx = x - s.x;
      const dy = y - s.y;
      if (Math.abs(dy) < DISTANCE || Math.abs(dy) < STEEPNESS * Math.abs(dx)) return;
      if (dy > 0 && s.atTop) onSwipeDown();
      else if (dy < 0 && s.atBottom) onSwipeUp();
    };
    const cancel = () => {
      start = null;
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches.length === 1 ? e.touches[0] : undefined;
      if (t) begin(t.clientX, t.clientY, e.target);
      else cancel();
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (t) finish(t.clientX, t.clientY);
    };
    const onMouseDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button === 0) begin(e.clientX, e.clientY, e.target);
    };
    const onMouseUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') finish(e.clientX, e.clientY);
    };

    root.addEventListener('touchstart', onTouchStart, { passive: true });
    root.addEventListener('touchend', onTouchEnd, { passive: true });
    root.addEventListener('touchcancel', cancel, { passive: true });
    root.addEventListener('pointerdown', onMouseDown);
    window.addEventListener('pointerup', onMouseUp);
    return () => {
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchend', onTouchEnd);
      root.removeEventListener('touchcancel', cancel);
      root.removeEventListener('pointerdown', onMouseDown);
      window.removeEventListener('pointerup', onMouseUp);
    };
  }, [ref, onSwipeDown, onSwipeUp]);
}

/** The nearest element between `target` and `root` that scrolls vertically, if any. */
function scrollParent(target: EventTarget | null, root: HTMLElement): HTMLElement | null {
  let el = target instanceof Element ? target : null;
  while (el && el !== root) {
    if (el instanceof HTMLElement && el.scrollHeight > el.clientHeight + 1) {
      const overflow = getComputedStyle(el).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') return el;
    }
    el = el.parentElement;
  }
  return null;
}
