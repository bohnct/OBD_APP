/**
 * The one exception to "read only": clearing trouble codes (OBD mode 04).
 *
 * Mode 04 erases stored codes and resets the emissions readiness monitors. It cannot move
 * anything on the vehicle, but it is still an instruction rather than a question, so it is
 * kept off the normal allowlist and can only be sent through CommandGate.clearCodes with a
 * one-time authorisation from here. An authorisation is only issued when:
 *   - the engine was just read as not running (0 rpm), and
 *   - the person confirmed twice.
 * It is good for one use, within a short time of being issued.
 */

/** How long an authorisation stays valid after it is issued. */
export const CLEAR_AUTHORISATION_MS = 30_000;
/** Confirmations the person must give before codes are cleared. */
export const REQUIRED_CONFIRMATIONS = 2;

export interface ClearCheck {
  /** Engine speed read from the vehicle just now, or null if it couldn't be read. */
  readonly engineRpm: number | null;
  /** How many times the person confirmed. */
  readonly confirmations: number;
}

export type ClearRefusalReason = 'engineRunning' | 'engineUnknown' | 'notConfirmed';

export class ClearRefused extends Error {
  constructor(readonly reason: ClearRefusalReason) {
    super(CLEAR_REFUSAL_TEXT[reason]);
    this.name = 'ClearRefused';
  }
}

export const CLEAR_REFUSAL_TEXT: Record<ClearRefusalReason, string> = {
  engineRunning: 'Turn the engine off (key on, engine off) before clearing codes.',
  engineUnknown: "Couldn't confirm the engine is off, so codes weren't cleared.",
  notConfirmed: 'Clearing codes needs both confirmations.',
};

/** An opaque, single-use permission to send one mode 04 request. */
export interface ClearAuthorisation {
  readonly issuedAt: number;
}

/** Authorisations issued and not yet used. Only this module can add to it. */
const outstanding = new WeakSet<ClearAuthorisation>();

/** Issues an authorisation, or throws ClearRefused saying why not. */
export function authoriseClear(check: ClearCheck, now = Date.now()): ClearAuthorisation {
  if (check.confirmations < REQUIRED_CONFIRMATIONS) throw new ClearRefused('notConfirmed');
  if (check.engineRpm === null || !Number.isFinite(check.engineRpm)) {
    throw new ClearRefused('engineUnknown');
  }
  if (check.engineRpm > 0) throw new ClearRefused('engineRunning');
  const authorisation: ClearAuthorisation = Object.freeze({ issuedAt: now });
  outstanding.add(authorisation);
  return authorisation;
}

/**
 * Uses up an authorisation. True only for one issued here, not used before and still
 * fresh; a copy or a made-up object is never accepted.
 */
export function consumeClearAuthorisation(
  authorisation: ClearAuthorisation,
  now = Date.now(),
): boolean {
  if (!outstanding.has(authorisation)) return false;
  outstanding.delete(authorisation);
  const age = now - authorisation.issuedAt;
  return age >= 0 && age <= CLEAR_AUTHORISATION_MS;
}
