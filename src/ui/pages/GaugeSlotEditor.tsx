import { useEffect, useMemo, useRef, useState } from 'react';
import { session } from '../../app/session';
import { getProfile } from '../../profiles/registry';
import type { Parameter } from '../../profiles/schema';
import { useLive } from '../../state/live';
import { gaugeLayoutFor, useSettings, type ScaleOverride } from '../../state/settings';
import { Choice } from '../settings/Choice';
import type { GaugeTheme } from '../theme/themes';
import { themeVariables } from '../theme/themeVariables';
import { unitChoices } from '../units';
import { useDisplayParameter, type DisplayParameter } from '../useDisplayParameter';

interface Props {
  readonly theme: GaugeTheme;
  readonly slot: number;
  readonly onClose: () => void;
}

/**
 * Settings for one gauge, opened by holding it: what it shows (searchable list of every
 * value the vehicle and app know), and its scale: units, min, max and warning zones.
 * Scale settings belong to the value, so its plot and data bar follow them too.
 */
export function GaugeSlotEditor({ theme, slot, onClose }: Props) {
  const profileId = useSettings((s) => s.profileId);
  const current = useSettings((s) => gaugeLayoutFor(s, profileId)[slot]);
  const setSlot = useSettings((s) => s.setGaugeSlot);
  const resetLayout = useSettings((s) => s.resetLayout);
  const dialog = useRef<HTMLDialogElement>(null);
  const parameters = getProfile(profileId).parameters;
  const param = parameters.find((p) => p.id === current);
  const [view, setView] = useState<'settings' | 'source'>('settings');

  // While open, read every parameter so each option can show whether it has live data.
  useEffect(() => {
    const settings = useSettings.getState();
    const layout = gaugeLayoutFor(settings, profileId);
    const all = getProfile(profileId).parameters.map((p) => p.id);
    session.setActive([...layout, ...all.filter((id) => !layout.includes(id))]);
    return () => {
      session.setActive(gaugeLayoutFor(useSettings.getState(), profileId));
    };
  }, [profileId]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    el.showModal();
    return () => {
      el.close();
    };
  }, []);

  const where =
    slot < 4 ? `top row, gauge ${String(slot + 1)}` : `bottom row, gauge ${String(slot - 3)}`;

  return (
    <dialog
      ref={dialog}
      className="slot-editor"
      style={themeVariables(theme)}
      aria-labelledby="slot-editor-title"
      onCancel={(e) => {
        e.preventDefault();
        if (view === 'source') setView('settings');
        else onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // tap outside the panel
      }}
    >
      <div className="slot-editor-panel">
        <header>
          <h2 id="slot-editor-title">{view === 'source' ? 'Choose data' : 'Gauge settings'}</h2>
          <span className="hint">{where}</span>
        </header>
        {view === 'source' ? (
          <SourcePicker
            parameters={parameters}
            current={current}
            onPick={(id) => {
              setSlot(profileId, slot, id);
              setView('settings');
            }}
          />
        ) : param ? (
          <ScaleSettings
            profileId={profileId}
            param={param}
            onChangeSource={() => {
              setView('source');
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setView('source');
            }}
          >
            Choose what this gauge shows
          </button>
        )}
        <footer>
          {view === 'source' ? (
            <button
              type="button"
              onClick={() => {
                setView('settings');
              }}
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                resetLayout(profileId);
                onClose();
              }}
            >
              Reset all gauges
            </button>
          )}
          <button type="button" className="primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </dialog>
  );
}

const NO_SCALE: ScaleOverride = {};

/** Units, min, max and warning zones for one value. */
function ScaleSettings({
  profileId,
  param,
  onChangeSource,
}: {
  readonly profileId: string;
  readonly param: Parameter;
  readonly onChangeSource: () => void;
}) {
  const d = useDisplayParameter(param);
  const override = useSettings((s) => s.scales[profileId]?.[param.id] ?? NO_SCALE);
  const setScale = useSettings((s) => s.setScale);
  if (!d) return null;
  const units = unitChoices(param.unit).map((c) => c.unit);

  /** Saves one field, in the unit currently shown. An empty min or max goes back to default. */
  const save = (patch: ScaleOverride, clear?: 'min' | 'max') => {
    const { min, max, ...rest } = { ...override, unit: d.unit, ...patch };
    setScale(profileId, param.id, {
      ...rest,
      ...(clear === 'min' || min === undefined ? {} : { min }),
      ...(clear === 'max' || max === undefined ? {} : { max }),
    });
  };

  return (
    <div className="gauge-settings" key={`${param.id}|${d.unit}|${JSON.stringify(override)}`}>
      <div className="setting-row source-row">
        <span className="setting-label">Shows</span>
        <div className="source-current">
          <strong>{param.name}</strong>
          <LiveReading d={d} />
        </div>
        <button type="button" onClick={onChangeSource}>
          Change…
        </button>
      </div>

      {units.length > 1 ? (
        <Choice
          label="Units"
          value={d.unit}
          options={units}
          onChange={(unit) => {
            // Numbers set in the old unit wouldn't mean the same in the new one: start fresh.
            setScale(profileId, param.id, { unit });
          }}
        />
      ) : null}

      <div className="setting-grid">
        <NumberField
          label="Min"
          value={d.lo}
          onCommit={(v) => {
            if (v === null) save({}, 'min');
            else save({ min: v });
          }}
        />
        <NumberField
          label="Max"
          value={d.hi}
          onCommit={(v) => {
            if (v === null) save({}, 'max');
            else save({ max: v });
          }}
        />
        <NumberField
          label="Low warning"
          hint="at or below; empty for none"
          value={d.warnLow}
          onCommit={(v) => {
            save({ warnLow: v });
          }}
        />
        <NumberField
          label="High warning"
          hint="at or above; empty for none"
          value={d.redline}
          onCommit={(v) => {
            save({ warnHigh: v });
          }}
        />
      </div>

      <p className="hint">
        Scales start from the value&apos;s normal working range
        {param.source === 'standard' ? ' (from the OBD-II standard)' : ''}. Changes here also apply
        to this value&apos;s plot and All data bar, in {d.unit}.
      </p>
      {d.customised ? (
        <button
          type="button"
          onClick={() => {
            setScale(profileId, param.id, null);
          }}
        >
          Reset this scale to default
        </button>
      ) : null}
    </div>
  );
}

/** A number box that saves when you leave it or press Enter. Empty saves null. */
function NumberField({
  label,
  hint,
  value,
  onCommit,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly value: number | undefined;
  readonly onCommit: (value: number | null) => void;
}) {
  const initial = value === undefined ? '' : String(Number(value.toFixed(3)));
  const [text, setText] = useState(initial);
  const commit = () => {
    if (text === initial) return;
    const trimmed = text.trim();
    if (trimmed === '') {
      onCommit(null);
      return;
    }
    const n = Number(trimmed);
    if (Number.isFinite(n)) onCommit(n);
    else setText(initial);
  };
  return (
    <label className="number-field">
      <span className="setting-label">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

const SECTIONS = [
  { source: 'profile', title: 'This vehicle' },
  { source: 'calculated', title: 'Calculated' },
  { source: 'standard', title: 'Standard OBD-II' },
] as const;

/** Every value the app knows for this vehicle, searchable, with live readings. */
function SourcePicker({
  parameters,
  current,
  onPick,
}: {
  readonly parameters: readonly Parameter[];
  readonly current: string | undefined;
  readonly onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const problems = useLive((s) => s.problems);
  const supported = useLive((s) => s.supportedPids);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (p: Parameter) => {
    const text = `${p.name} ${p.short} ${p.unit}`.toLowerCase();
    return words.every((w) => text.includes(w));
  };
  // Values the vehicle doesn't report go to the bottom, folded away.
  const missing = (p: Parameter) =>
    problems[p.id] === 'unsupported' ||
    (p.request?.type === 'obd' &&
      supported !== null &&
      !supported.includes(parseInt(p.request.pid, 16)));
  const shown = useMemo(
    () => parameters.filter(matches),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parameters, query],
  );
  const available = shown.filter((p) => !missing(p));
  const unavailable = shown.filter(missing);

  return (
    <div className="source-picker">
      <input
        type="search"
        className="source-search"
        placeholder={`Search ${String(parameters.length)} values (e.g. fuel, temp, trip)`}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
        }}
        aria-label="Search values"
      />
      <div className="source-list">
        {SECTIONS.map(({ source, title }) => {
          const items = available.filter((p) => p.source === source);
          if (items.length === 0) return null;
          return (
            <section key={source}>
              <h3>
                {title} <span>{items.length}</span>
              </h3>
              <div className="slot-options">
                {items.map((p) => (
                  <SlotOption
                    key={p.id}
                    param={p}
                    selected={p.id === current}
                    onPick={() => {
                      onPick(p.id);
                    }}
                  />
                ))}
              </div>
            </section>
          );
        })}
        {unavailable.length > 0 ? (
          <details>
            <summary>
              Not reported by this vehicle <span>{unavailable.length}</span>
            </summary>
            <div className="slot-options">
              {unavailable.map((p) => (
                <SlotOption
                  key={p.id}
                  param={p}
                  selected={p.id === current}
                  onPick={() => {
                    onPick(p.id);
                  }}
                />
              ))}
            </div>
          </details>
        ) : null}
        {shown.length === 0 ? <p className="hint">Nothing matches “{query}”.</p> : null}
      </div>
    </div>
  );
}

/** A reading counts as live if it arrived within this long. */
const LIVE_MS = 5000;

function LiveReading({ d }: { readonly d: DisplayParameter }) {
  const connected = useLive((s) => s.connection.status === 'connected');
  const now = useNow(1000);
  const live = d.updatedAt != null && now - d.updatedAt < LIVE_MS;
  const reading =
    d.value != null
      ? `${d.format(d.value)} ${d.unit}`
      : (d.problem ?? (connected ? 'Checking…' : 'Not connected'));
  return (
    <span className="option-reading">
      <span className={`dot${live ? ' live' : ''}`} aria-hidden="true" />
      <span className={d.value != null ? 'value' : 'missing'}>{reading}</span>
      {live ? null : d.value != null ? <small>stale</small> : null}
    </span>
  );
}

interface OptionProps {
  readonly param: Parameter;
  readonly selected: boolean;
  readonly onPick: () => void;
}

/** One choice, with its current value so you can see whether the vehicle actually sends it. */
function SlotOption({ param, selected, onPick }: OptionProps) {
  const d = useDisplayParameter(param);
  if (!d) return null;
  return (
    <button type="button" aria-pressed={selected} title={param.name} onClick={onPick}>
      <span className="option-name">{param.name}</span>
      <span className="option-row">
        <LiveReading d={d} />
        {param.verified ? null : <small className="tag">unverified</small>}
      </span>
    </button>
  );
}

/** The current time, refreshed every `intervalMs`. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}
