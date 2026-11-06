# KANSEI handling card

Measured by `node tests/handling.test.mjs` on the fixture tracks in `tests/fixtures/`. The test fails if any number leaves its window (CONTRACT.md section 7). The figures below come from the run that produced this file. The sim is deterministic, so a rerun on the same engine prints the same figures.

| Measure | KOI | RONIN | TEMPEST | BANSHEE |
|---|---|---|---|---|
| 0–100 km/h dry, launch (Traction 1) | **7.42 s** (7.0–9.0) | **5.38 s** (4.8–6.2) | **3.79 s** (3.3–4.3) | **4.49 s** (3.8–5.0) |
| 0–100 km/h, shipped tune (Traction off on the RWD cars) | 7.42 s | 5.97 s | 3.85 s | 5.10 s |
| Top speed | **208.8 km/h** (185–215) | **252.9 km/h** (230–265) | **266.4 km/h** (245–280) | **299.9 km/h** (275–315) |
| 100–0 km/h dry | **39.0 m** (33–42) | **36.6 m** (33–42) | **33.0 m** (32–40) | **34.5 m** (33–42) |
| 100–0 km/h wet | 52.3 m | 49.5 m | 50.4 m | 48.0 m |
| Steady skidpad dry, left / right | **0.989 / 0.989 g** (0.90–1.10) | **1.011 / 1.011 g** (0.92–1.12) | **1.078 / 1.077 g** (1.00–1.20) | **1.013 / 1.013 g** (0.90–1.12) |
| Wet skidpad | 0.709 g, ratio **0.717** | 0.749 g, ratio **0.740** | 0.810 g, ratio **0.751** | 0.749 g, ratio **0.740** |
| Held drift 25–50°, AI drift mode on the skidpad | **34.4 s**, mean 33° | **35.1 s**, mean 32° | **13.1 s**, mean 32° (drift setup) | **34.3 s**, mean 33° |

Windows are in brackets. Every row passes. The checks also cover:

- **Left/right symmetry:** the skidpad left against right (within 0.03%), and a mirrored step-steer plus handbrake flick at 70 km/h. Peak yaw rate and peak slip match within 1e-12 for every car. The window is 2%.
- **Load conservation:** the four wheel loads sum to m g cos(θ) plus downforce every tick, on the banked oval and the twisty fixture with grade. The worst relative error is 4e-16. The lightest wheel never drops below the 5% floor.
- **Character order:** acceleration rises KOI < RONIN < BANSHEE < TEMPEST. Top speed rises KOI < RONIN < TEMPEST < BANSHEE. TEMPEST has the most grip.

## Race AI lap times

These are from `tests/race.test.mjs`: the second of two Time Attack laps by the race-line AI at skill 1. Every lap is valid with no wall contact.

| Track | KOI | RONIN | TEMPEST | BANSHEE |
|---|---|---|---|---|
| fixture skidpad | 14.69 | 14.47 | **13.89** | 14.54 |
| fixture oval | 41.29 | 39.21 | 37.77 | **37.70** |
| fixture twisty | 59.85 | 56.36 | **53.67** | 54.66 |
| Kessel Pass | 82.1 | 78.7 | **74.9** | 76.2 |
| Neon Overpass | 80.8 | 77.3 | **74.3** | 74.4 |
| Salt Ring | 50.7 | 48.9 | **46.6** | 47.5 |
| Cliffside | 89.3 | 84.9 | **81.3** | 81.6 |
| Practice Pad | 14.5 | 14.3 | **13.8** | 14.4 |

TEMPEST has the fastest lap everywhere except the power oval, where BANSHEE's extra 170 hp is worth 0.07 s.

## How each number is measured

- **0–100 km/h:** a standing start on the 3 km straight of the strip fixture, full throttle, auto gearbox. A plain lane-keeping steering law holds the car straight.
  - The card value uses Traction 1, which acts as launch control. The RWD cars ship with Traction 0 so the throttle can break the rear loose, and the second row shows that tune.
  - The clutch slips up to each car's launch rpm, so these are clutch launches.
- **Top speed:** two rolling starts on the same straight, one below the window and one above it, each run flat out for 3 km. They converge to within 1.2 km/h of each other, and the card value is their mean, which is the drag-limited equilibrium.
- **100–0 km/h:** steady 100 km/h, then the full brake pedal. ABS is always on: it caps each wheel's brake torque at what the tyre can return, given the lateral grip already in use.
- **Skidpad:** a circle of 60 m radius. Speed creeps up 0.2 m/s every second while a pure-pursuit driver holds the circle. The value is the best 2 s mean of v²/r while the car still holds the radius within 2 m with under 5.7° of body slip.
  - Wet uses the same circle and the wet surface.
- **Held drift:** the AI drift mode (`engine/ai.js`) drives the skidpad for 40 s. The value is the longest unbroken stretch with body slip between 25° and 50° at more than 25 km/h, with no wall hits and no resets.
  - The controller uses three feedback loops: yaw rate on the steering, path curvature on the throttle, and slip angle through the yaw-rate target.
  - TEMPEST runs `DRIFT_SETUPS.tempest` from `engine/cars.js`: Traction 0, Stability 0, front split 0.2 and balance 0.8. On its shipped grip setup it holds 0.85 s before the AWD pulls it straight. A drift-mode AI entrant given no tune uses its car's drift setup.

## Tuning rationale

- **KOI (light FR, naturally aspirated).** This is the car you learn to slide in.
  - The peaky torque curve gives slow, readable power. Its launch is power-limited, so Traction changes nothing.
  - Low rear grip, a soft slide plateau (0.72 of peak) and a 0.54 front balance let it rotate on lift-off or the handbrake at low speed.
  - A 380 N·m clutch cap and an ignition cut on upshifts stop shifts from kicking the rear out unasked.
- **RONIN (turbo FR, the default).** It is balanced.
  - The turbo's 0.5 s lag means the throttle loosens the rear a beat after you ask, a timing skill to learn.
  - The 0.6 diff lock keeps both rear wheels spinning together once the slide starts. Its 1.01 g skidpad sits in the middle of the field.
- **TEMPEST (AWD twin-turbo).** It grips.
  - It has the best skidpad (1.08 g), the shortest stops and the fastest laps.
  - The centre coupling sends 34% of the torque forward with a viscous lock, so power pulls the car straight. To slide it, the player dials in the drift setup and commits with the handbrake ("harder, needs handbrake").
- **BANSHEE (big-block V8 FR).** It is the pro car.
  - It has 780 N·m from low rpm, the stiffest diff (150 N·m preload, 0.6 power ramp) and the highest slide plateau (0.81), so it holds big angles at speed. It gets the highest drift scores on every circuit.
  - Without Traction, a careless foot costs 0.6 s to 100 km/h.
  - Its high drag (CdA 1.22) caps it at about 300 km/h.
- **Wet:** grip is ×0.72 on asphalt and curbs. Measured skidpad ratios are 0.72–0.75, and braking distances grow by 30–50%.
  - The AI reads the surface. Its speed profiles use the wet grip, and the drift controller shrinks its yaw-braking and lateral-stopping budgets by the same factor. On the wet the race AI laps the five circuits 13–18% slower than on the dry, every lap valid, with no wall contact. A 95 s drift run by every car on all seven tracks has no wall hit. Longer wet drift runs are not yet clean: at 150 s TEMPEST hits a wall on Kessel Pass.
- **Boost:** +35% torque, a finite reserve, drained in about 5 s. It recharges slowly off the button and about four times faster while drifting.

## Performance

Six cars at 120 Hz cost 34–43 µs per tick in Node 22, so a simulated second costs 4–5 ms. This is the `performance` check in `tests/race.test.mjs`, with all six cars AI-driven (four racing, two drifting) on the twisty fixture. The budget is 1 ms per tick.
