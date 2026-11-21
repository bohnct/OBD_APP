import type { Parameter } from '../../profiles/schema';
import { getProfile } from '../../profiles/registry';
import { useLive } from '../../state/live';
import { useSettings } from '../../state/settings';
import type { GaugeTheme } from '../theme/themes';
import { fraction } from '../gauges/geometry';
import { useDisplayParameter } from '../useDisplayParameter';
import { plotAddedMessage, useDoubleTap } from '../useDoubleTap';
import { useToast } from '../toastStore';

/**
 * Everything the vehicle reports, live: its own values, the standard OBD-II ones it says it
 * supports, and the calculated ones. Values it doesn't report are left out.
 */
export function AllDataPage({ theme }: { readonly theme: GaugeTheme }) {
  const profileId = useSettings((s) => s.profileId);
  const problems = useLive((s) => s.problems);
  const supported = useLive((s) => s.supportedPids);
  const order = { profile: 0, calculated: 1, standard: 2 } as const;
  const parameters = getProfile(profileId)
    .parameters.filter(
      (p) =>
        problems[p.id] !== 'unsupported' &&
        !(
          p.request?.type === 'obd' &&
          supported !== null &&
          !supported.includes(parseInt(p.request.pid, 16))
        ),
    )
    .sort((a, b) => order[a.source] - order[b.source]);
  return (
    <div className="data-grid">
      {parameters.map((param) => (
        <DataTile key={param.id} profileId={profileId} param={param} theme={theme} />
      ))}
    </div>
  );
}

interface TileProps {
  readonly profileId: string;
  readonly param: Parameter;
  readonly theme: GaugeTheme;
}

function DataTile({ profileId, param, theme }: TileProps) {
  const d = useDisplayParameter(param);
  const addPlot = useSettings((s) => s.addPlot);
  const showToast = useToast((s) => s.show);
  const plot = () => {
    showToast(plotAddedMessage(param.short, addPlot(profileId, param.id)));
  };
  const doubleTap = useDoubleTap(plot);
  if (!d) return null;
  const fill = d.value === null ? 0 : fraction(d.value, d.lo, d.hi) * 100;
  const red = d.redline === undefined ? null : fraction(d.redline, d.lo, d.hi) * 100;
  const low = d.warnLow === undefined ? null : fraction(d.warnLow, d.lo, d.hi) * 100;
  return (
    <button
      type="button"
      className="data-tile"
      style={{ background: theme.panel, borderColor: theme.line }}
      aria-label={`${d.name}: ${d.value === null ? 'no reading' : `${d.format(d.value)} ${d.unit}`}. Double-tap to plot it.`}
      {...doubleTap}
      onClick={(e) => {
        if (e.detail === 0) plot(); // keyboard
      }}
    >
      <div className="data-head">
        <span style={{ color: theme.mark }}>{d.label}</span>
        {param.verified ? null : (
          <span className="unverified" style={{ color: theme.sub }} title={param.note}>
            unverified
          </span>
        )}
      </div>
      <div className="data-value" style={{ color: theme.mark }}>
        {d.value === null ? '—' : d.format(d.value)}
        <span style={{ color: theme.sub }}> {d.unit}</span>
      </div>
      <div className="data-bar" style={{ background: theme.line }}>
        {red === null ? null : (
          <div
            className="data-red"
            style={{
              left: `${String(red)}%`,
              background: theme.red,
              boxShadow: theme.glow ? `0 0 4px ${theme.red}` : undefined,
            }}
          />
        )}
        {low === null || low <= 0 ? null : (
          <div
            className="data-red"
            style={{
              left: 0,
              right: `${String(100 - low)}%`,
              background: theme.red,
              boxShadow: theme.glow ? `0 0 4px ${theme.red}` : undefined,
            }}
          />
        )}
        <div
          className="data-fill"
          style={{ width: `${String(fill)}%`, background: theme.needle }}
        />
        {d.value === null ? null : (
          // A small upright pointer at the reading, so the position reads at a glance.
          <div
            className="data-marker"
            style={{
              left: `${String(fill)}%`,
              background: theme.needle,
              boxShadow: theme.glow ? `0 0 4px ${theme.needle}` : undefined,
            }}
          />
        )}
      </div>
      <div className="data-name" style={{ color: theme.sub }}>
        {d.problem ?? d.name}
      </div>
    </button>
  );
}
