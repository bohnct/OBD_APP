import { useEffect } from 'react';
import type { GaugeTheme } from './theme/themes';
import { useToast } from './toastStore';

const SHOW_MS = 1600;

export function Toast({ theme }: { readonly theme: GaugeTheme }) {
  const message = useToast((s) => s.message);
  const id = useToast((s) => s.id);
  const hide = useToast((s) => s.hide);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(hide, SHOW_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [message, id, hide]);
  return (
    <div className="toast" role="status" aria-live="polite">
      {message ? (
        <span
          key={id}
          style={{ background: theme.panel, color: theme.mark, borderColor: theme.line }}
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}
