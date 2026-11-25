import { useState } from 'react';
import { session } from '../../app/session';
import { saveSnapshot, type SaveOutcome } from '../../diagnostics/snapshot';
import { isWebBluetoothAvailable } from '../../link/vehicleLink';
import { getProfile, listProfiles } from '../../profiles/registry';
import type { GaugeStyle } from '../../profiles/schema';
import { useLive } from '../../state/live';
import { BACKLIGHTS, gaugeStyleFor, UPDATE_CHOICES, useSettings } from '../../state/settings';
import type { GaugeTheme } from '../theme/themes';
import { BACKLIGHT_COLORS } from '../theme/themes';
import { themeVariables } from '../theme/themeVariables';
import { Choice } from './Choice';

/**
 * The pull-down settings, laid out in three columns so everything fits on a landscape
 * phone without scrolling. Gauge layout is edited on the gauge page itself (hold a gauge).
 */
export function SettingsPanel({ theme }: { readonly theme: GaugeTheme }) {
  return (
    <div className="settings" style={themeVariables(theme)}>
      <section aria-labelledby="settings-vehicle">
        <h2 id="settings-vehicle">Vehicle</h2>
        <VehiclePicker />
        <Adapter />
        <UpdateRate />
      </section>
      <section aria-labelledby="settings-display">
        <h2 id="settings-display">Display</h2>
        <DisplayChoices />
      </section>
      <section aria-labelledby="settings-about">
        <h2 id="settings-about">Diagnostics</h2>
        <Diagnostics />
      </section>
    </div>
  );
}

function VehiclePicker() {
  const profileId = useSettings((s) => s.profileId);
  const update = useSettings((s) => s.update);
  const onChange = (id: string) => {
    update({ profileId: id });
    const reconnect =
      session.kind === 'simulator' && useLive.getState().connection.status === 'connected';
    void (reconnect ? session.connect('simulator', id) : session.disconnect());
  };
  return (
    <select
      aria-label="Vehicle"
      value={profileId}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    >
      {listProfiles().map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

function Adapter() {
  const connection = useLive((s) => s.connection);
  const vehicle = useLive((s) => s.vehicle);
  const profileId = useSettings((s) => s.profileId);
  const bluetooth = isWebBluetoothAvailable();
  const connected = connection.status === 'connected';
  const status =
    connection.status === 'connected'
      ? vehicle === 'silent'
        ? `${connection.adapterName} connected, but the vehicle isn't answering. Turn the key on; it keeps trying.`
        : `Connected: ${connection.adapterName}`
      : connection.status === 'connecting'
        ? 'Connecting…'
        : connection.status === 'reconnecting'
          ? `${connection.adapterName} dropped out. Reconnecting…`
          : connection.status === 'error'
            ? connection.message
            : 'Not connected';
  return (
    <>
      <p className={`status${connected && vehicle !== 'silent' ? ' ok' : ''}`} role="status">
        {status}
      </p>
      <div className="buttons">
        {connected ? (
          <button type="button" onClick={() => void session.disconnect()}>
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            className="primary"
            disabled={!bluetooth || connection.status === 'connecting'}
            onClick={() => void session.connect('bluetooth', profileId)}
          >
            Connect adapter
          </button>
        )}
        <button
          type="button"
          disabled={connection.status === 'connecting'}
          onClick={() => void session.connect('simulator', profileId)}
        >
          Simulator
        </button>
      </div>
      {bluetooth ? null : (
        <p className="hint">No Bluetooth in this browser. On iPhone, use the Bluefy browser.</p>
      )}
    </>
  );
}

const STYLE_NAMES: Record<GaugeStyle, string> = {
  ford95: "'95 Ford",
  superDuty: 'Super Duty main',
  superDutySmall: 'Super Duty small',
  subaru: 'Cluster',
  subaruConsole: 'Console',
  cruze: 'Cruze',
  performance: 'Generic',
};

const UPDATE_NAMES = { 0: 'Max', 250: '4/s', 500: '2/s', 1000: '1/s' } as const;

/**
 * How often the gauges update. "Max" reads as fast as the vehicle answers; slower settings
 * leave the adapter idle between updates (easier on old modules and phone batteries).
 */
function UpdateRate() {
  const updateMs = useSettings((s) => s.updateMs);
  const update = useSettings((s) => s.update);
  return (
    <Choice
      label="Updates"
      value={updateMs}
      options={[...UPDATE_CHOICES]}
      names={UPDATE_NAMES}
      onChange={(ms) => {
        update({ updateMs: ms });
      }}
    />
  );
}

function DisplayChoices() {
  const s = useSettings();
  const styles = getProfile(s.profileId).styles;
  return (
    <div className="choices">
      {styles.length > 1 ? (
        <Choice
          label="Style"
          value={gaugeStyleFor(s, s.profileId)}
          options={styles}
          names={STYLE_NAMES}
          onChange={(style) => {
            s.setStyle(s.profileId, style);
          }}
        />
      ) : null}
      {gaugeStyleFor(s, s.profileId) === 'performance' ? (
        <fieldset className="choice">
          <legend>Backlight</legend>
          <div className="swatches">
            {BACKLIGHTS.map((color) => (
              <label
                key={color}
                className={color === s.backlight ? 'selected' : undefined}
                style={{ ['--swatch' as string]: BACKLIGHT_COLORS[color] }}
                title={color}
              >
                <input
                  type="radio"
                  name="backlight"
                  value={color}
                  aria-label={color}
                  checked={color === s.backlight}
                  onChange={() => {
                    s.update({ backlight: color });
                  }}
                />
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <Choice
        label="Theme"
        value={s.themeMode}
        options={['auto', 'day', 'night']}
        names={{ auto: 'Auto', day: 'Day', night: 'Night' }}
        onChange={(themeMode) => {
          s.update({ themeMode });
        }}
      />
      <Choice
        label="Temp"
        value={s.temperatureUnit}
        options={['°F', '°C']}
        onChange={(temperatureUnit) => {
          s.update({ temperatureUnit });
        }}
      />
      <Choice
        label="Pressure"
        value={s.pressureUnit}
        options={['psi', 'kPa']}
        onChange={(pressureUnit) => {
          s.update({ pressureUnit });
        }}
      />
      <Choice
        label="Speed"
        value={s.speedUnit}
        options={['km/h', 'mph']}
        onChange={(speedUnit) => {
          s.update({ speedUnit });
        }}
      />
    </div>
  );
}

const BUILT = new Date(__BUILD_TIME__).toLocaleString();

const SAVE_MESSAGE: Record<SaveOutcome, (name: string) => string> = {
  shared: (name) => `Shared ${name}.`,
  downloaded: (name) => `Saved ${name} to Downloads.`,
  cancelled: () => 'Not saved.',
  failed: () => "Couldn't save the snapshot on this browser.",
};

function Diagnostics() {
  const blocked = useLive((s) => s.blocked.length);
  const [saved, setSaved] = useState<{ name: string; outcome: SaveOutcome } | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <>
      <div className="buttons">
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            // Works connected or not: after a failed connect, the record of what was tried
            // is what's needed.
            setSaving(true);
            void saveSnapshot().then((result) => {
              setSaved(result);
              setSaving(false);
            });
          }}
        >
          Save data snapshot
        </button>
      </div>
      <p className="hint" role="status">
        {saved
          ? SAVE_MESSAGE[saved.outcome](saved.name)
          : 'Records what was sent and received. Visit All data for 30 s first.'}
      </p>
      <p className="hint">
        Read-only: {blocked === 0 ? 'nothing blocked.' : `${String(blocked)} command(s) blocked.`}
      </p>
      <p className="hint">Hold a gauge to change what it shows.</p>
      <p className="hint faint">Version built {BUILT}</p>
    </>
  );
}
