import cruze from './vehicles/chevrolet-cruze-2018.json';
import fordF250 from './vehicles/ford-f250-73-1995.json';
import fordF350 from './vehicles/ford-f350-2024-67.json';
import generic from './vehicles/generic-obd2.json';
import impreza from './vehicles/subaru-impreza-2016.json';
import { CALCULATED_PARAMETERS } from './calculated';
import { ProfileSchema, type Profile } from './schema';
import { STANDARD_PARAMETERS } from './standardPids';

interface ProfileFile {
  readonly id: string;
  /** Inherit the parameters of another profile; own parameters with the same id replace them. */
  readonly extends?: string;
  readonly parameters: readonly { readonly id: string }[];
  readonly [key: string]: unknown;
}

const FILES: readonly ProfileFile[] = [fordF250, fordF350, impreza, cruze, generic];

function resolve(file: ProfileFile, seen: Set<string> = new Set()): unknown {
  if (!file.extends) return file;
  if (seen.has(file.id)) throw new Error(`Profile "${file.id}" extends itself.`);
  seen.add(file.id);
  const baseFile = FILES.find((f) => f.id === file.extends);
  if (!baseFile) throw new Error(`Profile "${file.id}" extends unknown "${file.extends}".`);
  const base = resolve(baseFile, seen) as ProfileFile;
  const own = new Map(file.parameters.map((p) => [p.id, p]));
  const parameters = [
    ...base.parameters.map((p) => own.get(p.id) ?? p),
    ...file.parameters.filter((p) => !base.parameters.some((b) => b.id === p.id)),
  ];
  const { extends: _ignored, ...rest } = file;
  return { ...rest, parameters };
}

/**
 * Adds the standard OBD-II list and the calculated values to a profile, skipping any the
 * profile already defines itself (same id, or the same standard PID).
 */
function withEverything(profile: ProfileFile): unknown {
  type Raw = { readonly id: string; readonly request?: { type?: string; pid?: string } | null };
  const own = profile.parameters as readonly Raw[];
  const ids = new Set(own.map((p) => p.id));
  const pids = new Set(own.flatMap((p) => (p.request?.type === 'obd' ? [p.request.pid] : [])));
  const extra = [
    ...STANDARD_PARAMETERS.filter((p) => !ids.has(p.id) && !pids.has(p.request.pid)),
    ...CALCULATED_PARAMETERS.filter((p) => !ids.has(p.id)),
  ];
  return { ...profile, parameters: [...own, ...extra] };
}

/** Every profile is validated at startup: a typo in a profile file fails loudly. */
const PROFILES: readonly Profile[] = FILES.map((file) => {
  const result = ProfileSchema.safeParse(withEverything(resolve(file) as ProfileFile));
  if (!result.success) {
    throw new Error(`Vehicle profile "${file.id}" is invalid:\n${result.error.message}`);
  }
  return result.data;
});

export function listProfiles(): readonly Profile[] {
  return PROFILES;
}

export function getProfile(id: string): Profile {
  const profile = PROFILES.find((p) => p.id === id);
  if (!profile) throw new Error(`Unknown vehicle profile "${id}".`);
  return profile;
}

export const DEFAULT_PROFILE_ID = 'ford-f250-73-1995';
