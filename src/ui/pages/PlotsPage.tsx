import { useSyncExternalStore } from 'react';
import { useHistoryClock } from '../../history/history';
import { getProfile } from '../../profiles/registry';
import { useSettings } from '../../state/settings';
import { HistoryLength } from '../plots/HistoryLength';
import { PlotCard } from '../plots/PlotCard';
import type { GaugeTheme } from '../theme/themes';
import { themeVariables } from '../theme/themeVariables';

const EMPTY: readonly string[] = [];

/** Phone held upright: one plot per row so each stays readable. */
const NARROW = '(max-width: 600px)';

function useNarrow(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(NARROW);
      query.addEventListener('change', onChange);
      return () => {
        query.removeEventListener('change', onChange);
      };
    },
    () => window.matchMedia(NARROW).matches,
  );
}

/** History plots of the parameters the user picked (double-tap a gauge or reading to add). */
export function PlotsPage({ theme }: { readonly theme: GaugeTheme }) {
  const profileId = useSettings((s) => s.profileId);
  const plotted = useSettings((s) => s.plots[profileId] ?? EMPTY);
  const seconds = useSettings((s) => s.historySeconds);
  const update = useSettings((s) => s.update);
  const removePlot = useSettings((s) => s.removePlot);
  const now = useHistoryClock();
  const parameters = getProfile(profileId).parameters;
  const shown = plotted.flatMap((id) => parameters.filter((p) => p.id === id));
  const narrow = useNarrow();
  const columns = narrow || shown.length <= 1 ? 1 : shown.length <= 4 ? 2 : 3;

  return (
    <div className="plots-page" style={themeVariables(theme)}>
      <HistoryLength
        theme={theme}
        value={seconds}
        onChange={(historySeconds) => {
          update({ historySeconds });
        }}
      />
      {shown.length === 0 ? (
        <p className="plots-empty">
          Nothing plotted yet. Double-tap a gauge, or a reading on the All data page, to plot it
          here. Swipe down to go back.
        </p>
      ) : (
        <div
          className="plots-grid"
          style={{ gridTemplateColumns: `repeat(${String(columns)}, minmax(0, 1fr))` }}
        >
          {shown.map((p) => (
            <PlotCard
              key={p.id}
              param={p}
              theme={theme}
              windowMs={seconds * 1000}
              now={now}
              onRemove={() => {
                removePlot(profileId, p.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
