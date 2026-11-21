import { useEffect, type ReactNode } from 'react';
import type { GaugeTheme } from '../theme/themes';

interface Props {
  readonly theme: GaugeTheme;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly children: ReactNode;
}

/**
 * A full-screen page that slides up from the bottom. Opened and closed by swipes handled in
 * the app shell (up to open, down to close); the handle and Escape also close it.
 */
export function PlotsSheet({ theme, open, onOpenChange, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onOpenChange]);

  return (
    <>
      {/* Keyboard access only; on screen the plots open with a swipe up. */}
      <button
        type="button"
        className="plots-open-key"
        aria-label="Open history plots"
        onClick={() => {
          onOpenChange(true);
        }}
      />
      <div
        className={`plots-sheet${open ? ' open' : ''}`}
        style={{ background: theme.background }}
        role="dialog"
        aria-label="History plots"
        aria-hidden={!open}
        inert={!open}
      >
        <button
          type="button"
          className="plots-grab"
          aria-label="Close history plots"
          onClick={() => {
            onOpenChange(false);
          }}
        >
          <span style={{ background: theme.sub }} />
        </button>
        {open ? children : null}
      </div>
    </>
  );
}
