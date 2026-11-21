import { useLive } from '../state/live';
import type { GaugeTheme } from './theme/themes';

/** A small notice while the vehicle isn't answering or the adapter is reconnecting. */
export function VehicleSilent({ theme }: { readonly theme: GaugeTheme }) {
  const message = useLive((s) =>
    s.connection.status === 'reconnecting'
      ? 'Adapter dropped out — reconnecting…'
      : s.connection.status === 'connected' && s.vehicle === 'silent'
        ? 'No reply from the vehicle — turn the key on. Still trying…'
        : null,
  );
  if (!message) return null;
  return (
    <div className="vehicle-silent" role="status">
      <span style={{ background: theme.panel, color: theme.mark, borderColor: theme.red }}>
        {message}
      </span>
    </div>
  );
}
