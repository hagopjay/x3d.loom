# x3d.anim: Theatre.js and GSAP timelines to and from X3D

An animation authored in **Theatre.js** (a saved sequence state) or **GSAP** (a timeline over plain objects) becomes one `TimeSensor`, one interpolator per animated field and two `ROUTE`s per field. The file plays in any X3D browser with no script. The same tools can instead keep the clock and write plain SAI field values into a running scene, in X_ITE or in either bridge (Babylon, three.js). The reverse also works: X3D interpolators become a Theatre state or GSAP code.

Id prefix for the docs chapter: `ANM` (x3d.docs chapter 15). Nothing under `x3d.webgpu/` or `x3d.threejs/` is edited; the verifier reads the three.js bridge's `tools/bundle.js` at run time.

## Pipeline

```text
 Theatre state.json --(@theatre/core evaluates)--+
                                                 +--> bake() --> channels --> x3d-write --> TimeSensor + *Interpolator + ROUTE
 GSAP timeline ------(tl.time(t) evaluates)------+       ^                                        |
                                                  authored key times kept                          v
 live: tool keeps the clock --> drive.js applyState --> node[field] = new X3D.SFVec3f(..)   X_ITE 16.6.0 | three.js bridge
 back: X3D text --> x3d-read --> export-back --> Theatre state / GSAP code
```

## Run

```sh
npm ci
export CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium     # or any Chromium; Playwright must match
npm test                                                 # 12 unit tests, no browser
node tools/build-browser.js                              # dist/x3d-anim.browser.js from src/{math,model,drive}.js
node tools/verify.js [--shots DIR]                       # X_ITE 16.6.0 + three.js bridge; writes receipts/*.json and fixtures/<case>.x3d
```

## Conventions (the contract with the authoring tool)

| thing | rule |
|---|---|
| object name | Theatre object name, or the key of the GSAP target tree, is the X3D `DEF` |
| prop path | `field` (scalar) or `field.x/y/z`, `field.r/g/b` (vector, colour); field names in `src/model.js` `FIELD_TYPES` (an unknown field is an error) |
| rotation | three Euler angles in **degrees**, applied about fixed X, then Y, then Z (`q = qz*qy*qx`); written as `OrientationInterpolator` axis-angle |
| unkeyed components | Theatre props with no track read 0, so pass `defaults` (a scale of 1, a colour) |
| colours | **ColorInterpolator blends in HSV** (spec, and X_ITE 16.6.0); the baker models that, so RGB tweens are re-keyed to match |
| eases | interpolators are piecewise linear: the baker samples at `fps` (60) plus the authored key times and drops samples within `tol`; the error is measured on an independent grid and returned, never assumed |
| steps / holds | a discontinuity cannot be a straight segment: `steps(6)` leaves 0.139 error at 60 fps (see the chapter's honest limits) |

## Files

| path | what |
|---|---|
| `src/theatre.js`, `src/gsap.js` | tool state to a neutral timeline; the tool's own maths is the oracle |
| `src/bake.js`, `src/model.js`, `src/math.js` | sampling, key reduction, HSV and slerp interpolation, Euler and quaternion helpers |
| `src/x3d-write.js`, `src/x3d-read.js`, `src/export-back.js` | timeline to X3D, X3D to timeline, timeline to Theatre state and GSAP code |
| `src/drive.js` | live driving: `applyState`, `bindGsap`, `bindTheatre`, `playTimeline`; also built to `dist/x3d-anim.browser.js` |
| `tools/verify.js`, `tools/cases.js`, `tools/xite.js`, `tools/bridge.js` | the rig; two cases (GSAP orbit, Theatre box) |
| `fixtures/`, `receipts/` | the generated scenes and one JSON receipt per case |
| `test/anim.test.js` | 12 tests: math round trips, HSV, bake bounds, X3D round trip, X3D to Theatre to core, X3D to GSAP code to GSAP |

## Licences (read before you ship)

- `@theatre/core` 0.7.2 is Apache-2.0 and is the only Theatre package imported here.
- `@theatre/studio` 0.7.2 (the editor) is **AGPL-3.0-only**. It is not imported, bundled or served by this package. An author runs it locally and saves the state JSON, which is data; the X3D written from it contains no Theatre code. If you embed the studio in a page you give to users, its AGPL terms apply to that page.
- `gsap` 3.15.1 is under GSAP's standard no-charge licence (https://gsap.com/standard-license): free for most uses, not all (it excludes building tools that compete with GSAP's own). Used at build time here and loaded from a CDN by the demo; the exported X3D contains none of it. Engineering notes, not legal advice.

## Rig for every number

Chromium 153.0.8010.12 on SwiftShader, X_ITE 16.6.0, three.js r187 with the x3d.threejs bridge body, GSAP 3.15.1, @theatre/core 0.7.2, Node 22. No frame rates (software GL is about 0.6 s a frame).
