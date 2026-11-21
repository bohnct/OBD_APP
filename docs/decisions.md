# Decision log

Short records of choices that shape the code. Newest first.

## Read-only, enforced in one place

**Decision:** All traffic goes through `src/safety/commandGate.ts`. Requests are typed
objects; the gate encodes them and checks the result against a fixed allowlist
(`src/safety/allowlist.ts`) before anything is written. ESLint forbids importing the
adapter client or transports outside `src/link`.

**Allowed:** modes 01, 02, 03, 07, 09, 0A, 22 (read data by ID); a short list of adapter
setup commands; AT SH only with headers listed in the active vehicle profile.

**Not allowed:** mode 04 (clear codes), mode 08, and every write, reset, security,
routine or programming service. Clearing the check-engine light needs another tool.

## PWA instead of an app store app

**Decision:** Installable web app (React + TypeScript + Vite), hosted on GitHub Pages.
No developer account needed. iPhone users run it in Bluefy, since Safari has no Web Bluetooth.

**Consequence:** BLE adapters only.

## Vehicle knowledge lives in profile files

**Decision:** PIDs, formulas, ranges, themes and default gauge layouts are JSON, validated
with Zod at startup. Code never names a vehicle. User changes to gauge layouts are saved
separately on the phone, so profile files stay clean.

## Fonts are bundled

**Decision:** Fonts come from `@fontsource` packages, not Google Fonts, so the app works
offline in the truck.
