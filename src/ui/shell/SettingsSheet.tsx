import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import type { GaugeTheme } from '../theme/themes';

const OPEN_DISTANCE = 60;

interface Props {
  readonly theme: GaugeTheme;
  readonly children: ReactNode;
}

/**
 * Settings that pull down from the top edge, like a phone's notification shade.
 * Swipe down from the top to open; swipe up, tap outside or press Escape to close.
 */
export function SettingsSheet({ theme, children }: Props) {
  const [open, setOpen] = useState(false);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const begin = (e: PointerEvent<HTMLDivElement>) => {
    // Keep receiving moves after the finger leaves the thin pull zone.
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = e.clientY;
  };
  const track = (direction: 'down' | 'up') => (e: PointerEvent) => {
    if (start.current === null) return;
    const dy = e.clientY - start.current;
    if (direction === 'down' && dy > OPEN_DISTANCE) {
      setOpen(true);
      start.current = null;
    } else if (direction === 'up' && dy < -OPEN_DISTANCE) {
      setOpen(false);
      start.current = null;
    }
  };
  const end = () => {
    start.current = null;
  };

  return (
    <>
      <div
        className="pull-zone"
        onPointerDown={begin}
        onPointerMove={track('down')}
        onPointerUp={end}
        onPointerCancel={end}
        aria-hidden="true"
      />
      {open ? (
        <div
          className="sheet-backdrop"
          onClick={() => {
            setOpen(false);
          }}
          aria-hidden="true"
        />
      ) : null}
      <div
        className={`sheet${open ? ' open' : ''}`}
        style={{ background: theme.background, color: theme.mark, borderColor: theme.line }}
        role="dialog"
        aria-label="Settings"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="sheet-body">{children}</div>
        <div
          className="sheet-handle"
          onPointerDown={begin}
          onPointerMove={track('up')}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <span style={{ background: theme.sub }} />
        </div>
      </div>
    </>
  );
}
