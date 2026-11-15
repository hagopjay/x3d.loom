# x3d.roam: KANSEI ROAM, a road you can feel

KANSEI v1.1 (the drift game in `x3d.drift/`, live copy in `platformer/kansei/v1.1`) follows a smooth road. ROAM adds the parts a driver feels through the seat: bumps, a suspension that moves, brakes that heat up, an engine that rolls the body. It is an **overlay**: `x3d.drift` and `kansei/v1`, `kansei/v1.1` are not edited. `tools/stage.py` copies the game, applies nineteen exact-once text patches (the build stops if x3d.drift changes under them) and adds four modules.

Play it: `kansei/roam-v1/` in the platformer repo (WebGPU build). Start any circuit in Free roam. F2 opens the telemetry panel with the ride and rotor rows.

Rig for every number: Node v22.23.4 (sim) and Chromium 153.0.8010.12 with SwiftShader (page gate). The sim is the same deterministic fixed-step code in both. Nothing here was felt on a real GPU or a real controller.

## What it adds

| file | what | where it plugs in |
|---|---|---|
| `engine/road.js` | the road as a pure function of arc length, lateral offset and world position: texture, long undulation, expansion joints with a lip, cracks, potholes (0.38 per 52 m cell), washboard zones, a rumble strip on the curb, rough runoff (rougher by its rolling resistance) | heights added under each wheel |
| `engine/susp.js` | a 7-DOF ride model: body heave, pitch, roll, four unsprung wheels on tyre springs, bump stops, asymmetric dampers, 4 sub-steps per tick (1/480 s) | the wheel loads (`Ld[i] += dFz`), the body pose, the wheel hub travel, a longitudinal force from climbing bumps |
| `engine/brakes.js` | two-node rotors (skin and bulk), pad fade from skin temperature, cold-pad penalty, hydraulic pressure lag, ABS flag | the brake torque, per wheel |
| `engine/roam.js` | `ROAM.on` and `ROAM.rough`; `on = false` is v1.1 bit for bit | everywhere |
| `main.js` patches | rotor and ride rows in F2, camera shake from the ride, gamepad rumble (dual-rumble: jolts and ABS on the strong motor, shake and curb on the weak), two tips, own storage namespace (`kansei.roam1.`) so v1.1 records do not mix in | the page |

Gears: the crank torque rolls the body (net reaction about the long axis, scaled 0.35), and the part of the wheel torque that changes faster than 4 Hz kicks the nose (a shift, a clutch dump, a lift). The 0.35 and the 0.10 kick factor are tuned by feel, not measured.

Engine id is `kansei-roam/1` (v1.1 tapes are for `kansei-engine/4` and would not replay; the build ships an empty `tapes/`).

## Checks (all green unless marked)

- ROAM off, whole v1.1 suite (`tests/run_all.mjs`: handling card, race, AI, exploits, 6 fixture tapes): **pass** (`results/v11-regression.txt`).
- ROAM on, `tests/roam.test.mjs`: 17 checks pass: determinism (two runs hash identically), the road is a pure function, the ride's heave frequency 1.54 Hz with a peak ratio of 0.065 per cycle, a 30 mm wheel hop moves 3.35 kN of load and rolls the body 0.91 degrees, then dies away, RONIN 0-100 5.38 s (v1.1) against 5.36 s with the ride on glass and 5.37 s on the shipped road, the brakes (below), hands-off straight within 1.47 m in 6 s.
- Browser gate (`tools/check_browser.cjs`, Chromium 153 SwiftShader, off-screen WebGPU texture, 500 ms frame pacing): the page boots, a free-roam session runs, the ride and rotor rows fill in, no page error. It judges no frame and no timing.
- **Not green, and why:** with the road on, the AI suites (`circuits.test.mjs`, `race.test.mjs`) show 3 failed checks of 110, each one wall touch in a wet drift or race lap (kessel-pass BANSHEE wet tandem, cliffside race, wet twisty TEMPEST). The AI was tuned on a flat road. The 107 other checks pass, every AI lap completes.

## What the road does (`results/feel.json`, sim, steady speed, 14 s runs)

Body vertical acceleration, rms: asphalt 0.05 g at 20 m/s rising to 0.08 to 0.09 g at 40 m/s (RONIN, TEMPEST); runoff 0.18 to 0.27 g. Wheel-load coefficient of variation: asphalt 0.10 to 0.14, runoff 0.43 to 0.54. Lightest wheel on the runoff at 20 to 40 m/s: 500 to 750 N against about 3000 N static.

Brakes: ten 160 to 40 km/h stops in a row (RONIN, back to the line each time): stop length 84.6 m, then 98.4 m at the tenth; front pad friction 1.00 down to 0.57 at the worst, front skin 365 up to 761 C; 90 s of rolling at 20 m/s brings the skin back to 267 C. The temperatures and the fade curve are game-tuned, not measured on a car.

## Findings worth keeping

1. **Engine roll reaction alone makes a hands-off car veer.** With a reaction factor of 0.9 the unsteered car was 10 m off the line after 5 s of a perfectly smooth 3 km straight; at 0.3 it was still 3 m off after 5 s and 19 m after 20 s (RONIN, about 100 km/h, no steering). I shipped 0.35 and the tests hold the line with a small steering controller. The roll puts more load on one side, the driven tyres then give unequal forces, and the car yaws. Real cars do this too (torque steer); v1.1 could not, because its loads were perfectly symmetric.
2. **Test drivers hide bugs.** Both my first brake-fade test and my first hold-the-line controller were wrong in ways the sim made look like physics (a yaw wrap of 2 pi read as a huge error and spun the car at launch).
3. **The roughness barely costs lap time on its own** (0-100 and 100-0 on the shipped asphalt equal v1.1 to the 0.01 s and the 0.1 m): what a bumpy road changes is the margin, the lightest wheel and the AI's wall touches, not the stopwatch.

## Limits

- The car is still a planar rigid body; the ride model feeds it wheel loads, a pose and one longitudinal force. A wheel that leaves the ground does not give vertical flight (the chassis height does not integrate gravity), only an unloaded tyre.
- No bump steer, no lateral force from slopes, no tyre enveloping beyond a three-point footprint average.
- The feel (haptics, camera shake) was not tested on a controller or a real display; the numbers above are from the sim.
- Brake and gear numbers are tuned for the game.

## Run it

```
python3 -I tools/stage.py --game ../x3d.drift --out /tmp/roam-stage
cd /tmp/roam-stage && node tests/roam.test.mjs && node tools/feel.mjs
python3 -I tools/build.py --out /tmp/roam-out            # the page (Babylon from the CDN, pinned hash)
NODE_PATH=$(npm root -g) node tools/check_browser.cjs /tmp/roam-out
```
