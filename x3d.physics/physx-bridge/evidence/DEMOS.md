# Four more demos (phase 5, 2026-11-12)

Requested by the user: "more interesting and fun and tinkerable demos but maintain same polish and glee". Chosen by the user: all four
offered. Everything below is **measured** on this Mac (Apple Silicon, headless Playwright: Chromium 145, Firefox 146, WebKit 26; Node 24
with the same PhysX 5.12 WASM) unless marked **read**.

## Three browsers, real WebGL (probes/run-*.mjs; evidence/<demo>-<browser>.json and .png)

| demo | check | Chromium | Firefox | WebKit |
|---|---|---|---|---|
| music box | Twinkle (18 pegs), notes struck in two turns | 36 | 36 | 36 |
| | notes in the next turn after pulling every peg live | 0 | 0 | 0 |
| | physics per step | 350 µs | 1250 µs | 273 µs |
| dominoes | mouse-drawn row: fell / wave speed | 27/27 · 0.930 m/s | 27/27 · 0.920 | 27/27 · 0.922 |
| | spiral: fell / wave speed | 134/134 · 0.986 m/s | 134/134 · 0.979 | 134/134 · 0.985 |
| trebuchet | release angle, speed, efficiency, range, blocks moved | 39.8°, 39.71 m/s, 64.5 %, 165.8 m, 7 | identical | identical |
| | joints left after firing and release | ArmHinge, CounterweightHinge | same | same |
| Galton | 240 beads poured + one shake: in bins, σ (bins) | 240, 2.58 | 233, 2.37 | 240, 2.63 |
| | physics per step while pouring / steps per second | 50 µs (end) · 240 | 7.3 ms · 128 (half real time) | 250 µs · 243 |
| all | console errors | 0 | 0 | 0 |

Sound: how it was checked. I cannot hear; the impact samples were synthesised and their tuning measured (`evidence/sounds.json`: the
music-box tine is C6 within 0.05 cents), and the pages report how many voices were triggered (music box 44 per run, dominoes 348–382,
trebuchet ~100 thuds, Galton ~2000–3000 ticks). That the voices reach the WebAudio destination was shown in phase 4 for the same code path.

## Node (tools/*-sim.ts; evidence/*-sim-*.json, dominoes-sweep.json)

- **Music box**: every peg exactly one note on its own bar, no wrong bars, at 60/120/200 BPM for four patterns (12 runs). Strike impulse
  2.2–2.35 mN·s, even. What it took: square pins (round ones: strikes varied 6× with tempo); a check rail (minAngle −0.1 rad); hammers
  anchored to the pivot rod. Anchored to the world, the hammer arms also collided with the rod, an accidental pivot friction the first
  tuning relied on; anchored to the rod PhysX skips that pair and at 200 BPM hammers were flung to their stop (24/36 notes) until the rail.
- **Dominoes**: wave speed v/√(gH) against gap/H for friction 0.1/0.2/0.3 (dominoes 51.6 × 25.5 × 7.9 mm, as Larham's). μ 0.1: 1.75 → 0.84
  (stops beyond 0.75 H); μ 0.2: 1.46 → 0.82; μ 0.3: 1.26 → 0.83. **Read** (Larham, arXiv:1302.3311, table 1): 1.07 at 0.04 H, 1.53 at
  0.23, 1.40 at 0.62, 1.23 at 0.82. PhysX does not reproduce the slow-down at the tightest gaps. A gentle push (2.5 rad/s) stalls rows with
  gaps ≤ 0.2 H; the page pushes at 6 rad/s. Eager sleeping breaks the wave (20–27 of 134 fell); 1/120 s halves cost but changes speed 2.6 %.
- **Trebuchet**: 2000 kg, 37 kg stone, 5 m sling, 40°: release 39.8° at 39.71 m/s, 64.5 %, 168 m on open ground. Release 30/50/60°:
  155/162/135 m. Counterweight 1250/3000 kg: 74/279 m. Sling 3/7 m: 88/155 m. Castle blocks 120 kg → 2 moved, 40 kg → 8 (the page says so).
- **Galton**: single beads, 40 each: pitch 18/19/20 mm → σ 1.08/1.60/2.69 bins (binomial 1.73); thin pins at 20 mm stair-step to the walls
  whatever the drag or bounce; pin jitter does not fix it. Full pours: a gravity-fed hopper jams (156 of 240 stuck at 18 mm); metering
  into a chute fixes it; 18 wedged beads cleared by a shake of upward gravity taps (240/240). Tilt 0/4/8°: σ 2.5/2.9/3.6, centre −0.06/+0.45/+0.23.
  Contacts 'found' 4.0 ms/step vs 'sensed' 1.3 (identical bins).

## Files

All four exports (`scenes/demos/*.x3d`) and every other scene validate with the x3d_mcp server: XSD valid, 0 errors, 0 warnings (27 files).
