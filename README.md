# Rocket 3D — editable render

A 3D reconstruction of the reference rocket graphic (teal nose, dark blue hull,
white window with teal ring, 3 light-blue fins, red/orange/yellow exhaust flame).

## Run it

Open `rocket.html` in any browser — it is a single self-contained file
(Three.js is bundled inline, works offline, double-clickable).

- Drag to orbit, scroll to zoom.
- The panel (top right) edits colors and shape live.

## Edit it

All design values live in the `PARAMS` block at the top of the script inside
`rocket.html` (search for `EDITABLE PARAMETERS`), or in `src/main.js` when using
the multi-file project:

- `rocket.html` — single-file build (what you open in the browser)
- `index.html` + `src/main.js` + `lib/` — editable source project; serve the
  folder over HTTP (e.g. `python3 -m http.server`) because browsers block ES
  modules from `file://`, then open `index.html`
- `build.mjs` — rebuilds both from `src/main.js` (`npm install && node build.mjs`)

## Editable parameters

| Group | Keys |
|---|---|
| colors | body, nose, fin, windowRing, window, flameRed/Orange/Yellow/Tip |
| shape | bodyRadius, halfHeight, noseLength, finCount, finSpan, finThickness, windowY, windowRadius, ringWidth, flameLength, flameRadius, flameWobble |
| toggles | showFlame, showGrid |

## Parts

- Hull: lathe profile measured from the reference; teal nose cone with an abrupt
  color transition, dark blue body, tapered boat-tail at the base.
- Window: white disc + teal torus ring on the hull at `windowY`.
- Fins: `finCount` extruded plates evenly spaced around the axis (default 3 at
  120°, so the back side looks the same as the front).
- Exhaust: lathe flame with scalloped edge and a red→orange→yellow→white
  vertical gradient, plus a bright inner core; gently animated.
