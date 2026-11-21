# OBD Gauges

A read-only engine gauge display for your phone. It talks to a Bluetooth Low Energy OBD
adapter and shows live engine data as gauges styled after the vehicle's own cluster.

- **1995 F-250 7.3 Powerstroke**: '95 Ford-style gauges (green at night) with ICP, IPR,
  boost, EBP, oil temp and more from Ford's mode 22 data.
- **2016 Subaru Impreza** and any standard OBD2 vehicle: Subaru-style round dials.

**It can only read.** Every command passes one safety gate (`src/safety`) that allows read
requests only. It cannot clear codes, run tests, or write to any module.

## Using it

| Gesture                            | Does                                              |
| ---------------------------------- | ------------------------------------------------- |
| Swipe left / right                 | Gauges ↔ All data                                 |
| Swipe down from the top edge       | Settings: vehicle, adapter, gauge layout, display |
| Swipe up on settings / tap outside | Close settings                                    |

- **Android:** open the site in Chrome, then _Add to Home screen_.
- **iPhone:** Safari blocks Bluetooth for web pages. Open the site in the **Bluefy** browser.
- **Adapter:** must be Bluetooth Low Energy _and_ support J1850 PWM for the '95 Ford
  (e.g. vLinker MC+ BLE). Classic Bluetooth and Wi-Fi adapters can't be reached from a browser.

## Working on it

Needs [Node.js](https://nodejs.org) 22 or newer.

```sh
npm install
npm run dev        # http://localhost:5173/?sim starts the simulator
npm run check      # typecheck + lint + tests (run before every commit)
npm run build      # production build in dist/
```

Open `/?sim` to start with simulated data, no adapter needed.

To test on your phone: Web Bluetooth needs HTTPS, so test Bluetooth through the GitHub
Pages build (below). The simulator works over plain `http://<laptop-ip>:5173/?sim`.

## Testing in the vehicle from a laptop

Chrome and Edge on Windows can use Bluetooth Low Energy adapters, so the laptop works as a test bench:

1. Plug the adapter in, key on. Run `start.bat` (or `npm run dev`).
2. Swipe down → **Connect Bluetooth adapter** and pick the adapter.
3. Visit the **All data** page for 30 seconds so every reading gets requested.
4. Swipe down → **Diagnostics → Save data snapshot**. A `.json` file lands in Downloads.

The snapshot holds every command sent, every raw reply and the decoded values. Drop it
in a `captures/` folder here to compare the app's formulas against the real vehicle.

## Deploying to GitHub Pages

1. Create a GitHub repository and push this folder to it.
2. In the repository: **Settings → Pages → Source: GitHub Actions**.
3. Every push to `main` runs the checks and publishes to
   `https://<your-user>.github.io/<repo>/`.

## How the code is laid out

```
src/
  safety/      command gate + allowlist: the only path to the adapter (read-only)
  elm/         ELM327 line protocol and reply parsing
  transport/   Web Bluetooth and the simulator
  link/        opens a gated connection to a vehicle
  obd/         typed request definitions
  profiles/    vehicle profiles (JSON) + schema + decoding
  polling/     reads the on-screen parameters in a loop
  state/       settings (saved on the phone) and live readings
  app/         connection session
  ui/          gauges, pages, settings sheet, themes
```

Layers only call downward. ESLint stops anything outside `link/` from importing the
adapter client or transports directly.

## Adding a vehicle

Add a JSON file to `src/profiles/vehicles/` and list it in `src/profiles/registry.ts`.
A profile can `extend` another (the Impreza extends `generic-obd2`). Each parameter says
how to request it, how to decode it (`value = raw × scale + offset`), its unit and gauge
range. Profiles are validated when the app starts, so mistakes fail loudly.

Parameters marked `"verified": false` haven't been checked on the real vehicle yet. The
7.3 mode 22 IDs come from 1999-2003 7.3 PID lists and need checking on the '95.

See `docs/decisions.md` for why things are built the way they are.
