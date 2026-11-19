# Learnings: two Giza H-Anim demos (Demos 63 and 64, 19 Nov 2026)

The Blender pipelines lane built both demos on x3d-blender-io 8310e7b and Blender 5.3.0 (bpy pip wheel). They share one 16-joint H-Anim 2.0 figure (`build/rig.py`).

**Grades:**
- **C**, Confirmed: shown by a named tool in this work.
- **L**, Likely: strong evidence, but one cause not isolated.
- **S**, Suspected.

**Rig:** every browser number comes from Playwright headless Chromium 157.0.8103.78 with SwiftShader and no GPU, running X_ITE 16.7.1.

**Validator:** x3d_mcp 39c6e94 (`validate_xml` XSD, `validate_semantic`). Both files: 0 errors, 0 warnings.

| Demo | Folder in x3d.demo | Headline |
|---|---|---|
| 63 Giza Crawl | `docs/demos/blender-giza-crawl/v1/` | An H-Anim explorer walks, stoops, crawls and climbs a 452 s, 28-chapter route: Great Pyramid passages, the Subterranean Chamber, the Osiris Shaft, and an Authored Hall of Records. Every chapter is graded Documented, schematic, Authored or Cut. |
| 64 Giza Fall | `docs/demos/blender-giza-fall/v1/` | An 11-body, 80 kg Bullet ragdoll is shoved off the 138.5 m summit and tumbles down 203 stepped courses. The motion is baked onto H-Anim joints. Its 197 logged impacts are played as synthesised Web Audio thuds, smacks and knocks. |

## 1. Rules for the next agent

| # | Rule | Grade | Evidence |
|---|---|---|---|
| 1 | **An armature object's own keyframes do not reach the X3D.** Only joint animation is written. Parent the armature to an animated Empty and key the Empty: that exports a PositionInterpolator on the carrier Transform. | C | Demo 64: the faller's joints tumbled while the figure stayed on the summit. The only change was the carrier, and the figure then moved. |
| 2 | **Keep a skinned humanoid's travel off the root joint.** When `humanoid_root` translated more than 100 m, the skinned mesh vanished from the X_ITE frame. It fits culling by the bounds of the rest coordinates. Put the travel on a carrier Empty and leave only a local offset on the root. | L | Demo 64 frames before and after the change; the cause was not isolated in X_ITE's code |
| 3 | **The X_ITE SAI browser has no `currentTime`.** `startTime = browser.currentTime - t` gives NaN and a dead clock. X3D scene time is epoch seconds, so use `Date.now()/1000`. | C | Demo 63 page probe: `currentTime` undefined; a TimeSensor with startTime 0 already reported fraction 0.43 |
| 4 | **A new `startTime` is ignored while a TimeSensor is active.** To jump, set `enabled = false`, wait about 120 ms, then set `enabled = true` and `startTime = now - t`. | C | Demo 63 chapter jumps |
| 5 | **For a frame-exact check, drive every interpolator's `set_fraction` through SAI** and disable the timer. Don't rely on the wall clock. Read a moved value one frame later, because events propagate on the next frame. | C | Demo 63: 28/28 chapters, Demo 64: 15 times |
| 6 | **Measure a rig's sign conventions with a picture, not only a number.** `forward_sign()` returned r = -1, yet `+r * tilt` laid the crawl on its back. A Cycles side view of all six gaits (`pose_check.py`, 8 samples, about 3 s on CPU) caught it. EEVEE and Workbench need a GPU or EGL, which the headless wheel does not have. | C | Demo 63 pose.png before and after |
| 7 | **Tight passages need a different camera.** A chase camera 2.4 m behind a walker in a 0.7 m shaft fills the frame with torso. Walls built inward-facing and back-face culled let the camera stand outside the wall and look in, like a section drawing. | C | Demo 63 contact sheets before and after |
| 8 | **The add-on writes a Background only for imported scenes.** A generated scene gets none (Demo 64) or a near-black one from the world colour (an earlier build), and X_ITE clears to near-black. Insert the sky as a scripted step in the generator. | C | Demo 64 exports |
| 9 | **Bake a Bullet ragdoll by matrices, not by constraints.** Record each body's world matrix per frame. Then compute each bone's pose as `W⁻¹ · B_f · B_0⁻¹ · W_0 · rest` in parent order, and derive `matrix_basis` from the parent's pose. There is no `nla.bake` and no view-layer update per bone. | C | Demo 64 build_fall.py; Blender world positions match the X3D frames |
| 10 | **Shove with kinematic keys, then release.** Key the bodies' transforms while `rigid_body.kinematic = True`, and key it False on the release frame: Bullet picks up the keyed velocity. Check the tilt direction in a frame. The first shove tipped the figure backward, and the next one landed it flat on the summit. | C | Demo 64 runs 1 to 3 |
| 11 | **An impact list from positions alone:** impulse = mass × \|v₂ − v₁ − g·Δt\| per body per frame. A threshold of 18 N·s with a 40 ms merge gave 197 hits for a 138 m fall. In software GL the browser's frame gaps can exceed 0.25 s, so a hit window of 0.35 s keeps most sounds. | C | Demo 64 fall.json; page test 10 of 14 sounds at 0.25 s |

## 2. What this does not prove

* The Demo 64 fall is a simulation with authored friction (0.45) and restitution (0.15) on idealised steps. A real body on broken limestone would most likely stop on a ledge. The page says so.
* The Demo 63 course of the well shaft and the Osiris plan are schematic. The Hall of Records is invented (Cayce legend). Three cuts are teleports.
* There was no real GPU, phone or audio-output check: the sounds were counted, not heard.

## 3. Candidate add-on fixes (not made yet)

1. Export an armature object's own transform animation (rule 1).
2. Optionally write a Background from the world colour for every scene, not only imported ones (rule 8).
3. Carried over from Demos 58 to 61: add the H-Anim 2.0 joint names to the name table.
