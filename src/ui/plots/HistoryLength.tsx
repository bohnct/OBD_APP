import { useEffect, useRef, useState } from 'react';
import { HISTORY_CHOICES, type HistorySeconds } from '../../state/settings';
import type { GaugeTheme } from '../theme/themes';

const NAMES: Record<HistorySeconds, string> = {
  30: '30 s',
  60: '1 min',
  300: '5 min',
  900: '15 min',
};

interface Props {
  readonly theme: GaugeTheme;
  readonly value: HistorySeconds;
  readonly onChange: (value: HistorySeconds) => void;
}

/** A stopwatch button showing the history length; tap it to pick another. */
export function HistoryLength({ theme, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
    };
  }, [open]);

  return (
    <div className="history-length" ref={root}>
      <button
        type="button"
        className="history-button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`History length: ${NAMES[value]}. Change`}
        onClick={() => {
          setOpen((o) => !o);
        }}
        style={{ color: theme.mark, borderColor: theme.line }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="13.5" r="7.5" />
            <path d="M12 13.5V9.5M10 3h4M12 3v2.5M18.5 7l1.5-1.5" />
          </g>
        </svg>
        <span>{NAMES[value]}</span>
      </button>
      {open ? (
        <div
          className="history-menu"
          role="radiogroup"
          aria-label="History length"
          style={{ background: theme.panel, borderColor: theme.line }}
        >
          {HISTORY_CHOICES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={s === value}
              className={s === value ? 'selected' : undefined}
              style={{
                color: s === value ? theme.mark : theme.sub,
                borderColor: s === value ? theme.mark : 'transparent',
              }}
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
            >
              {NAMES[s]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
