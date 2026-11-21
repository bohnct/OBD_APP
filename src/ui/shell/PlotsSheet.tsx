import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import type { GaugeTheme } from '../theme/themes';

const SWIPE_DISTANCE = 60;

interface Props {
  readonly theme: GaugeTheme;
  /** Called with true when the sheet opens and false when it closes. */
  readonly onOpenChange: (open: boolean) => void;
  readonly children: ReactNode;
}

/**
 * A full-screen page that slides up from the bottom edge. Swipe up from the bottom to
 * open; swipe down from its top strip, or press Escape, to close.
 */
export function PlotsSheet({ theme, onOpenChange, children }: Props) {
  const [open, setOpen] = useState(false);
  const start = useRef<number | null>(null);

  useEffect(() => {
    onOpenChange(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const begin = (e: PointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = e.clientY;
  };
  const track = (direction: 'up' | 'down') => (e: PointerEvent) => {
    if (start.current === null) return;
    const dy = e.clientY - start.current;
    if (direction === 'up' && dy < -SWIPE_DISTANCE) {
      setOpen(true);
      start.current = null;
    } else if (direction === 'down' && dy > SWIPE_DISTANCE) {
      setOpen(false);
      start.current = null;
    }
  };
  const end = () => {
    start.current = null;
  };

  return (
    <>
      <button
        type="button"
        className="pull-zone-bottom"
        aria-label="Open history plots (or swipe up from the bottom edge)"
        onClick={(e) => {
          if (e.detail === 0) setOpen(true); // keyboard
        }}
        onPointerDown={begin}
        onPointerMove={track('up')}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <div
        className={`plots-sheet${open ? ' open' : ''}`}
        style={{ background: theme.background }}
        role="dialog"
        aria-label="History plots"
        aria-hidden={!open}
        inert={!open}
      >
        <div
          className="plots-grab"
          onPointerDown={begin}
          onPointerMove={track('down')}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <span style={{ background: theme.sub }} />
        </div>
        {open ? children : null}
      </div>
    </>
  );
}
