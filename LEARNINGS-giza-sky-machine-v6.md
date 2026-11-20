# Learnings: Demo 65 v5 and v6, the outside review and the Sky Machine (20 Nov 2026)

The owner handed over an outside engineering review of the v4 Sacred Geometry Atlas with a finished v5 build, and asked to "integrate the engineering reviews upgrades and enhance, augment advance and intensify at your discretion." The Blender pipelines lane kept v5 exactly as delivered (`docs/demos/blender-giza-numbers/v5/`) and built v6 beside it (`v6/`): the lines every sky claim names, drawn in the star layer of the X3D scene.

**Grades:**
- **C**, Confirmed: shown by a named tool here.
- **L**, Likely.
- **S**, Suspected.

**Rig:** Playwright headless Chromium with SwiftShader, running X_ITE 16.7.1, at 1366 px and 390 px. Software GL: no frame rate is quoted.

**Validator:** x3d_mcp fork 39c6e94 through the Loom kit (`loom grammar`, `loom traps --host strict`, `loom pagetraps`).

**Sources:** Petrie 1883 sections 20 and 21 through the Birdsall transcription; HYG v4.1 (David Nash, CC BY-SA 4.0); ERFA 2.0.1.5 `ltpequ` and `ltpecl`.

## 1. Rules for the next agent

### X_ITE and the page

| # | Rule | Grade | Evidence |
|---|---|---|---|
| 1 | **Never set an X_ITE canvas from `update="false"` back to `"auto"`. Set `"true"`.** After false then auto the scene draws again, but a ProximitySensor keeps reporting the pose it had before the pause. Any second layer that copies that sensor (a star layer, a HUD) then shows the old direction over the new ground, with no error anywhere. With `"true"` the sensor follows again. | C | rig: camera quaternion read after a pause cycle, auto = stale on three moves, true = correct on three moves; `v6/stage.mjs resume()` |
| 2 | **A pause for off-screen stages needs three parts, not one.** Stop your own frame loop; on return bind the last pose again; and when a button below the stage moves the camera, scroll to the stage and wait until it is on screen before the move. A unit test with a fake sensor passes without any of this, so test it in a browser with a real scroll. | C | `v6/atlas.mjs requestStage`, `v6/tests/stage.test.mjs` |
| 3 | **After a bind, read the sensor for a few frames before trusting it.** An on-demand frame loop that runs once after `set_bind` reads the old pose. v6 keeps the loop alive for 700 ms after a bind or a resume, and a long exposure waits for that window before its first step. | C | rig: trails vanished at the end of an exposure until this was added |
| 4 | **Guard every field callback inside its own body.** X_ITE swallows what a callback throws. The page trap `xite-callback-unguarded` caught two callbacks passed by reference; an arrow with its own try/catch passes. | C | `loom pagetraps`: fail, then pass |
| 5 | **A static test double cannot find rule 1.** The delivered build had 47 passing tests, one of them for this very pause, and it asserted the wrong value (`auto`). A test that states the vendor's attribute value is only as good as a browser run that proved the value. | C | `v5/tests/stage.test.mjs` against the rig |

### Lines in the sky

| # | Rule | Grade | Evidence |
|---|---|---|---|
| 6 | **Draw sky lines as thin TriangleStripSet ribbons with UnlitMaterial, in the star layer, at one fixed radius.** A LineSet is one pixel wide and aliases on a 4K screen. Three strips per line (a core and two halos with rising transparency) read as a glowing line. Put the lines at a radius inside the far stars and outside the near ones; they need no depth trick because the star layer has its own viewpoint. | C | `v6/build/build_celestial.py`; XSD and semantic pass |
| 7 | **One Transform per frame of reference, each with one rotation.** Horizon frame: none. Equator frame: Rx(latitude − 90°), static. Ecliptic of date: Rx(latitude − 90°) · Ry(−LST) · Rz(obliquity), set through the SAI. J2000 frame (the pole's path, the ruler): the same rotation the stars use. Labels are stored as unit vectors per frame and projected by the page with that frame's quaternion, so they turn with their lines. | C | `v6/tests/machine.test.mjs`: ecliptic pole one obliquity from the pole, equinox on the equator, agrees with the star table to 0.02° |
| 8 | **Check a derived table by a second road.** Declination was computed two ways: through the precession matrix, and as 90° minus the distance from the pole's own path. They agree to 0.02° for four stars in two years. | C | same test file |
| 9 | **Tick calendars in calendar years.** Astronomical year −2999 is 3000 BC. Ticks placed on round astronomical years read "2,001 BC" on screen. | C | first rig frame, then `calendarTicks` test |
| 10 | **Label priority is a design decision.** Line labels took the collision grid first and the key stars vanished. Order: key stars, then line labels, then every other star. | C | rig frames before and after |
| 11 | **A long exposure is a 2D canvas over the scene, not a render trick.** Each frame projects the bright stars with the page's own camera maths and strokes a segment from the last position with additive blending. Under reduced motion the whole exposure is drawn at once. Clear it when the camera moves. | C | `v6/stage.mjs trailStep()`; rig frames north and south |

### Evidence

| # | Rule | Grade | Evidence |
|---|---|---|---|
| 12 | **Count facts, not claims.** Tie each claim to the one measured thing it rests on. The 63 claims rest on 19 facts about the monuments; 11 stand on one slope; 12 measure nothing at Giza. Say plainly that the table is editorial. | C for the counts, editorial for the table | `v6/build/build_witness.py`, test "witness table" |
| 13 | **Ask a joint question after the separate ones.** Four shafts each fit a star exactly in some year. Asked for one year they choose 2403 BC and still miss by 0.26° RMS; in 2560 BC, 0.74°. The joint fit is the honest size of the claim. | C | `shaftConsensus`, test against the v4 receipt |
| 14 | **Close the loop on a survey table.** Petrie's four casing lengths and four bearings walk back to the start within 0.04 inch (1 mm) in 921 m. Closure is a check on the transcription as much as on the survey: a mistyped side would not close. | C | `v6/build/build_survey.py`, re-read from the transcription 20 Nov 2026 |
| 15 | **Keep an outside build as delivered and build the next version beside it.** v5 is byte for byte what the reviewer sent; its one defect found here (rule 1) is fixed in v6 and written in v6's README, not patched into v5. | C | `v5/` commit, `v6/README.md` |

## 2. Folded into the kit

- New page trap `xite-update-auto-resume` (warning): a file that sets `update` to `"false"` and later to `"auto"`. It flags `v5/stage.mjs:162` and passes `v6`. The kit self-test now reads 9 page-trap rules, each with a clean fixture and a failing one.
- Not done: the Loom evidence files record the validator's local path; harmless here, worth a relative path.

## 3. Numbers behind the page

Thuban 1.34° from the pole in 2560 BC, closest 0.10° about 2797 BC (v4 receipt: 2796 BC, a flat minimum). Polaris closest 0.46° about AD 2102 (L). Vega never closer than about 3.5° (L). Obliquity 23.98° in 2560 BC. Belt, Alnitak to Mintaka: 2.734° in 2560 BC, 2.736° in AD 2000. Casing square: mean side 9068.80 in, closure 1 mm, worst corner 21 mm, 3′43″ west of north. 65 of 65 unit tests pass.
