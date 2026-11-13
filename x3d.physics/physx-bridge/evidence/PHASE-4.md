# Phase 4 evidence: race, sound, record and replay, looks, info panels (2026-11-12)

All numbers **measured** on this Mac unless marked. Browsers: Chromium 145.0.7632.6, Firefox 146.0.1, WebKit 26.0 (Playwright 1.58.2).

| file | what |
|---|---|
| `p4-run-{chromium,firefox}.json` | recorded runs (every step message and state hash, the exact model) |
| `p4-determinism-{chromium,firefox}.json` | a run recorded in one engine, replayed in all three browsers and Node (`probes/determinism.mjs`) |
| `p4-race-{browser}.json` + `-run/-end.png` | the race: PhysX marbles and Bullet ghosts dropped together, per-marble distance series (`probes/run-race.mjs`) |
| `p4-sounds.json` | the synthesised samples and their measured peaks (`tools/make-sounds.ts`) |
| `p4-sound-{browser}.json` | the audio that reaches the WebAudio destination during a run (`probes/run-sound.mjs`) |
| `p4-look-{photoreal,loom}-{browser}.png` | both looks (`probes/run-looks.mjs`) |
| `p4-info-{build,run}-chromium.png` | info panels (`probes/run-info.mjs`) |

## Results

1. **Record and replay is bit-exact across engines.** A 1918-step run (Drop 20, 21 teleports, 335 batches with kinematic paths) recorded in Chromium replays with 0 differing state hashes (FNV-1a over every moving body's float32 pose and velocities, every step) in Chromium (same page and a fresh page), Firefox, WebKit and Node. A 969-step run recorded in Firefox: likewise 0 in all. The SPEC's open question (is WASM PhysX bit-for-bit identical across browsers?) is answered **yes, on this Mac, for these engines**; across machines it is not yet measured (the run files are the tool: replay one on another machine).
2. **The race.** The same machine runs on X_ITE's Bullet inside an Inline (collection, marbles and clocks EXPORTed, IMPORTed by the run scene: standard X3D); each marble and its ghost are dropped together. After 11–14 s: PhysX 12–19 marbles in the cup, Bullet 10–12; mean distance between twins 25–31 cm, max 63–74 cm; no ghost fell out of this machine. Divergence plot (gold mean, grey per marble, crosshair tooltip) and a table view.
3. **Sound, checked without ears.** Six samples synthesised by modal synthesis (no third-party audio): the bell is at 1046.47 Hz for C6 (1046.50: −0.05 cents), the xylophone bar at 523.23 Hz for C5 (−0.06 cents); each sample's strongest peak is its designed mode. In the page, impacts trigger X3D SpatialSound voices (AudioClip sources): sample by material pair, intensity by impulse, location at the contact point, pitch by the chime's note. An analyser tapped into the WebAudio destination measured signal peaks of 0.51–0.74 (RMS up to 0.14) and signal in 73–79 % of 50 ms windows during 8 s of Drop 20, in all three browsers. With 4 voices per sample, the quietest impacts are skipped when every voice is busy (590–693 of about 1000 in Chromium and WebKit).
4. **Looks.** Photoreal: PhysicalMaterial, shadows, PBR-neutral tone mapping and an image-based EnvironmentLight lit by a procedural studio cube map (six PixelTextures). EnvironmentLight is X3D 4.1, so it is added at runtime through SAI and never written to exported files (they stay X3D 4.0; X_ITE loads the CubeMapTexturing component on demand). Loom: gold on dark materials, gold box outlines (Switch), glowing marble trails (LineSet updated per frame). Switching is instant (SAI), no reload; no errors in three browsers.
5. **Info panels.** Build mode: each piece lists the X3D fields it relies on with their PhysX mapping row and what X_ITE's Bullet does with them. Run mode: the loss report (per-status counts; authored fields lost: none for the default machine; grouped build notes) and frame and physics timing.

## Found and fixed

- Silence at first: the page state's `volume` number was overwritten by the `volume` function (the same `Object.assign` mistake as phase 3's undo stack), every intensity became NaN, X_ITE's SpatialSound threw on the non-finite AudioParam and stopped traversing. Fixed, and `expose()` now refuses to overwrite a state field.
- Firefox again is the slow engine: the race and the full machine simulate about 6 s in 14 s of wall time there.

## Limits

- Cross-machine determinism is not measured (one Mac). Cross-browser is.
- Sound loudness and timbre were measured as signal, not judged by ear.
- The Bullet ghost cannot follow slow motion or replays (it steps once per frame): it waits, and the page says so.
