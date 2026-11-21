import { useEffect, type ReactNode } from 'react';
import type { GaugeTheme } from '../theme/themes';

interface Props {
  readonly theme: GaugeTheme;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly children: ReactNode;
}

/**
 * Settings that slide down from the top. Opened and closed by swipes handled in the app
 * shell (down to open, up to close); tapping outside, the handle, or Escape also closes it.
 */
export function SettingsSheet({ theme, open, onOpenChange, children }: Props) {
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
      {open ? (
        <div
          className="sheet-backdrop"
          onClick={() => {
            onOpenChange(false);
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
        <button
          type="button"
          className="sheet-handle"
          aria-label="Close settings"
          onClick={() => {
            onOpenChange(false);
          }}
        >
          <span style={{ background: theme.sub }} />
        </button>
      </div>
    </>
  );
}
