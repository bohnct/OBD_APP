import { useEffect, useState } from 'react';
import { session } from '../../app/session';
import type { ClearResult, CodesResult, TroubleCodes } from '../../link/vehicleLink';
import { describeCode } from '../../obd/dtcDescriptions';
import type { CodeKind } from '../../obd/dtc';
import { CLEAR_REFUSAL_TEXT } from '../../safety/clearAuthorisation';
import { useLive } from '../../state/live';
import { useSettings } from '../../state/settings';
import type { GaugeTheme } from '../theme/themes';

type ReadState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'reading' }
  | { readonly kind: 'read'; readonly codes: TroubleCodes; readonly at: number }
  | { readonly kind: 'failed'; readonly message: string };

/** The clear-codes flow: two separate confirmations, then the result. */
type ClearStep = 'none' | 'first' | 'second' | 'clearing';

/**
 * Trouble codes: stored, pending and permanent, with the check engine light. Reading is an
 * ordinary read request. Clearing is the app's one instruction to the vehicle; it needs
 * the engine off and two confirmations, and the safety gate checks both again.
 */
export function CodesPage({
  theme,
  active,
}: {
  readonly theme: GaugeTheme;
  readonly active: boolean;
}) {
  const connected = useLive((s) => s.connection.status === 'connected');
  const profileId = useSettings((s) => s.profileId);
  const [state, setState] = useState<ReadState>({ kind: 'idle' });
  const [clearStep, setClearStep] = useState<ClearStep>('none');
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const read = async () => {
    setState({ kind: 'reading' });
    setState(toReadState(await session.readTroubleCodes()));
  };

  // Read whenever the page comes into view while connected.
  useEffect(() => {
    if (!active || !connected) return;
    let current = true;
    void session.readTroubleCodes().then((result) => {
      if (current) setState(toReadState(result));
    });
    return () => {
      current = false;
    };
  }, [active, connected]);

  const clear = async () => {
    setClearStep('clearing');
    const result = await session.clearTroubleCodes(2);
    setClearStep('none');
    setNotice({ text: clearMessage(result), ok: result?.ok ?? false });
    if (result?.ok) await read();
  };

  const colours = { color: theme.mark, borderColor: theme.line };
  return (
    <div className="codes-page" style={{ color: theme.mark }}>
      <div className="codes-summary">
        <h2 className="codes-title">Trouble codes</h2>
        <Summary state={state} connected={connected} theme={theme} />
        {notice ? (
          <p className="codes-note" style={{ color: notice.ok ? theme.mark : theme.red }}>
            {notice.text}
          </p>
        ) : null}
        {connected ? (
          <div className="codes-actions">
            <button
              type="button"
              className="codes-button"
              style={colours}
              onClick={() => {
                setNotice(null);
                void read();
              }}
              disabled={state.kind === 'reading' || clearStep === 'clearing'}
            >
              Read again
            </button>
            <button
              type="button"
              className="codes-button"
              style={{ color: theme.red, borderColor: theme.red }}
              onClick={() => {
                setNotice(null);
                setClearStep('first');
              }}
              disabled={clearStep !== 'none' || state.kind !== 'read'}
            >
              Clear codes
            </button>
          </div>
        ) : null}
        {connected ? (
          <p className="codes-note" style={{ color: theme.sub }}>
            Clearing needs the engine off with the key on, and asks twice.
          </p>
        ) : null}
      </div>

      <div className="codes-list">
        {clearStep === 'first' || clearStep === 'second' || clearStep === 'clearing' ? (
          <ClearConfirm
            step={clearStep}
            theme={theme}
            onCancel={() => {
              setClearStep('none');
            }}
            onContinue={() => {
              if (clearStep === 'first') setClearStep('second');
              else void clear();
            }}
          />
        ) : null}
        {state.kind === 'read' ? (
          <CodeList codes={state.codes} profileId={profileId} theme={theme} />
        ) : null}
      </div>
    </div>
  );
}

function Summary({
  state,
  connected,
  theme,
}: {
  readonly state: ReadState;
  readonly connected: boolean;
  readonly theme: GaugeTheme;
}) {
  if (!connected) {
    return (
      <p className="codes-status" style={{ color: theme.sub }}>
        Connect to the vehicle to read its codes. Swipe down for settings.
      </p>
    );
  }
  if (state.kind === 'reading' || state.kind === 'idle') {
    return (
      <p className="codes-status" style={{ color: theme.sub }}>
        Reading codes…
      </p>
    );
  }
  if (state.kind === 'failed') {
    return (
      <p className="codes-status" style={{ color: theme.red }}>
        {state.message}
      </p>
    );
  }
  const { codes, at } = state;
  const pending = codes.pending?.length ?? 0;
  const lamp =
    codes.mil === null
      ? 'Check engine light not reported'
      : codes.mil
        ? 'Check engine light on'
        : 'Check engine light off';
  return (
    <div className="codes-status">
      <p className="codes-lamp" style={{ color: codes.mil ? theme.red : theme.mark }}>
        {lamp}
      </p>
      <p style={{ color: theme.sub }}>
        {codes.stored.length} stored · {pending} pending · read{' '}
        {new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      </p>
    </div>
  );
}

function CodeList({
  codes,
  profileId,
  theme,
}: {
  readonly codes: TroubleCodes;
  readonly profileId: string;
  readonly theme: GaugeTheme;
}) {
  const rows: { code: string; kind: CodeKind }[] = [
    ...codes.stored.map((code) => ({ code, kind: 'stored' as const })),
    ...(codes.pending ?? []).map((code) => ({ code, kind: 'pending' as const })),
    ...(codes.permanent ?? []).map((code) => ({ code, kind: 'permanent' as const })),
  ];
  if (rows.length === 0) {
    return (
      <p className="codes-empty" style={{ color: theme.sub }}>
        No trouble codes.
      </p>
    );
  }
  return (
    <ul className="codes-rows">
      {rows.map(({ code, kind }) => {
        const meaning = describeCode(code, profileId);
        return (
          <li
            key={`${kind}-${code}`}
            className={`code-row code-${kind}`}
            style={{ borderColor: theme.line }}
          >
            <div className="code-head">
              <span className="code-name">{code}</span>
              <span
                className="code-kind"
                style={{
                  color: kind === 'pending' ? theme.mark : theme.red,
                  borderColor: kind === 'pending' ? theme.line : theme.red,
                }}
              >
                {KIND_LABEL[kind]}
              </span>
            </div>
            <p className="code-text">{meaning.text}</p>
            <p className="code-source" style={{ color: theme.sub }}>
              {SOURCE_LABEL[meaning.source]}
              {kind === 'pending' ? ' · seen once, not confirmed yet' : ''}
              {kind === 'permanent' ? " · stays until the computer sees it's fixed" : ''}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function ClearConfirm({
  step,
  theme,
  onCancel,
  onContinue,
}: {
  readonly step: ClearStep;
  readonly theme: GaugeTheme;
  readonly onCancel: () => void;
  readonly onContinue: () => void;
}) {
  const first = step === 'first';
  return (
    <div className="codes-confirm" role="alertdialog" style={{ borderColor: theme.red }}>
      <p className="codes-confirm-title" style={{ color: theme.red }}>
        {first ? 'Clear all trouble codes?' : 'Are you sure?'}
      </p>
      <p style={{ color: theme.mark }}>
        {first
          ? 'This erases stored and pending codes and resets the emissions readiness checks. The check engine light goes out until a fault is found again. The engine must be off with the key on.'
          : "This can't be undone. Write the codes down first if you need them."}
      </p>
      <div className="codes-actions">
        <button
          type="button"
          className="codes-button"
          style={{ color: theme.mark, borderColor: theme.line }}
          onClick={onCancel}
          disabled={step === 'clearing'}
        >
          Cancel
        </button>
        <button
          type="button"
          className="codes-button"
          style={{ color: theme.red, borderColor: theme.red }}
          onClick={onContinue}
          disabled={step === 'clearing'}
        >
          {step === 'clearing' ? 'Clearing…' : first ? 'Continue' : 'Clear codes'}
        </button>
      </div>
    </div>
  );
}

const KIND_LABEL: Record<CodeKind, string> = {
  stored: 'Stored',
  pending: 'Pending',
  permanent: 'Permanent',
};

const SOURCE_LABEL = {
  generic: 'Standard code',
  maker: 'Maker code (may vary by year)',
  group: 'Description not on file; system shown',
} as const;

function toReadState(result: CodesResult | null): ReadState {
  if (result === null) return { kind: 'failed', message: 'Not connected.' };
  if (result.ok) return { kind: 'read', codes: result.codes, at: Date.now() };
  if (result.error === 'noData' || result.error === 'notConnected') {
    return {
      kind: 'failed',
      message: "The vehicle didn't answer. Turn the key on and read again.",
    };
  }
  if (result.error === 'rejected') {
    return { kind: 'failed', message: 'The vehicle refused the request for codes.' };
  }
  return { kind: 'failed', message: "Couldn't read codes. Try again." };
}

function clearMessage(result: ClearResult | null): string {
  if (result === null) return 'Not connected.';
  if (result.ok) return 'Codes cleared.';
  switch (result.error) {
    case 'engineRunning':
    case 'engineUnknown':
    case 'notConfirmed':
      return CLEAR_REFUSAL_TEXT[result.error];
    case 'noAnswer':
      return "The vehicle didn't confirm the clear. Read again to check.";
    case 'blocked':
    case 'failed':
      return "Couldn't clear codes. Try again.";
  }
}
