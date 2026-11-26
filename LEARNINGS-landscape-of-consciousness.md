# Learnings: A Landscape of Consciousness in X3D, and a hosted page under a sandbox (25 November 2026)

The ask: take Robert Lawrence Kuhn's *Landscape of Consciousness* figure (by Alex Gomez-Marin; `hagopjay/gcloud.map/consciousnesssLandscape-copy.webp`) and make it an X3D world using as much of the X3D framework as possible. The world was built from one transcription. It is 4.25 MB of X3D 4.0, published as a hosted page that runs X_ITE: https://claude.ai/artifact/8voZSJ2DA1KyL3XybeAJKQ (private to the owner). Build notes: project doc `build-2026-11-25-landscape-of-consciousness.md`.

Grades: **C** Confirmed (re-run here), **L** Likely, **S** Suspected.

Rig for every claim below:
- X_ITE 16.8.1 in Google Chrome for Testing 153.0.8010.12, headless under Playwright.
- ANGLE on Mesa llvmpipe (LLVM 20.1.2); no hardware GPU.
- Validator: x3d_mcp fork `4d433af`. x3d.loom: `1078fc3`.
- Python 3.13.18, Node 22.23.5, fontTools 4.67.0, mapbox_earcut 2.1.0.

## What was built

| piece | size | check |
|---|---|---|
| transcription | 10 families, 13 sub-branches, 209 entries; 2 spellings corrected | counts per column match the figure (97 + 6 + 16 + 2 + 12 + 12 + 20 + 15 + 21 + 8) |
| world | X3D 4.0, Interchange profile + 13 components; 209 PROTO instances, 200 ROUTEs, 13 viewpoints, 33 looping clocks | XSD 4.0 valid; meaning: 0 errors, 1 deliberate warning (the empty far level of the label LOD) |
| forms | 10, one per family, among them a tesseract turned by an ECMAScript Script, two GLSL shaders, a ParticleSystem, a trefoil Möbius band and a Penrose tribar that closes only from an OrthoViewpoint | 13 viewpoint frames + 4 page frames |
| style | `xst:kuhn-landscape`, an x3d.style `xst/1` sentence carried on the root Group | lint: 10/12 as authored, 12/12 after `repair` and one hand change |
| labels | glyph geometry: 118 glyph meshes, 21 inks, 532 glyph × ink Shapes, 2,363 USEs, 361 KB library | drawn under a strict no-eval, same-origin-fetch policy |
| page | catalogue, search, fly-to-entry (a Focus Viewpoint aimed through the SAI), river ride, pause motion | page witness run under an emulated hosted policy (section 2) |

## 1. What the Loom witnesses said (`kit/loom`, re-run after the build)

The build itself used the validator, the style kit and a frame rig directly. Running the Loom's own witnesses afterwards found things those checks had not.

| witness | status | what it found |
|---|---|---|
| `grammar` (x3d_mcp fork) | pass | XSD 4.0 valid |
| `meaning` | pass | 0 semantic errors |
| `traps --host strict` | pass, 0 errors, 40 warnings | **`no-script-under-host`**: the rule predicted the Script failure that the hosted page later showed (section 2, item 3). **29 × `color-keys-sparse`**: the river motes' ColorInterpolators jump between family hues on adjacent keys, and X3D blends them in HSV, so a reader that blends RGB draws other colours in between; never looked for in the frames (**L**). **10 × `loop-seam`**: the action potentials jump from the dendrite tip back to the soma, by design; the rule cannot tell a deliberate restart from a seam |
| `traps --host xite` | pass, 0 errors, 39 warnings | as above, minus `no-script-under-host` |
| `pagetraps` | **fail, 2 errors, 1 warning** | **2 × `xite-callback-unguarded`**: both `addFieldCallback` bodies call the page without a `try`, so an exception inside them can break X_ITE's event cascade. **`loadurl-unbudgeted`**: if `loadURL` never settles, the loader overlay never clears. These are live defects in the published page |
| instrument | refused | `grammar` first stopped with `InstrumentError: fork venv not found`; it refused rather than passing. A `--system-site-packages` venv in the fork fixed it |

**Lesson (C):** the witnesses are cheaper than the bugs they catch. Run `traps`, `pagetraps`, `grammar` at the first draft, not after publishing. Two of the four findings above were already Loom rules.

## 2. The hosted page: what the sandbox took away

A hosted page may load scripts only from a short list of CDNs. It cannot `fetch()` another origin, and it may not be allowed `eval`. Files the author did not write and cannot read whole (minified X_ITE, its WASM, binary fonts) are not published with the page. So X_ITE comes from jsdelivr, and everything else the world needs has to be in the page's own files.

The deployment was emulated in this order:
1. X_ITE served from a second origin.
2. The artifact-style CSP injected as a response header by a Playwright route: `script-src 'self' 'unsafe-inline' <cdn>; style-src 'self' 'unsafe-inline'; connect-src 'self'`, with no `unsafe-eval`.
3. Bisection: unblock one resource class at a time and look at the canvas.

The real artifact page was not framed.

1. **The view is hidden until its stylesheet loads (C).** X_ITE builds its browser `div` with `style="display:none"` and reveals it on the `load` event of `x_ite.css`. Under `style-src 'self'` the stylesheet is refused, so the canvas stays 0 × 0. The page shows a black panel; the only signal is a page error whose message is `Event`. The SAI still works: the scene loads, fields can be set, and nothing is visible.
   - Bisection: CSS unblocked gave 620 × 576 and a full scene; fetch unblocked alone stayed 0 × 0.
   - Fix: inject three rules of the page's own into the shadow root (`.x_ite-private-browser`, `-surface`, `-canvas` at 100%) and clear the inline `display:none`.
2. **Text needs a font fetch, and WOFF2 needs eval (C).** X_ITE loads its font files with `fetch()`, so under `connect-src 'self'` every Text node is empty. Even same-origin, a `.woff2` font goes through `woff2_decoder.js`, which evaluates a string, so a no-eval policy also leaves the labels empty. X_ITE calls the decoder only when the file starts with the `wOF2` magic number.
   - Fix used: **text as geometry.** Ubuntu outlines are flattened (5 segments per quadratic) and triangulated (earcut, holes assigned by containment). Each glyph is defined once in a `Switch whichChoice=-1` library, and every label is a run of `<Shape USE>` instances. Cost: 3.73 → 4.25 MB (+14%). Gain: no font is ever fetched, and any X3D reader draws the labels.
   - Alternative for a vendored build: decompressed TrueType bytes under the `.woff2` name skip the decoder (C).
3. **A Script node needs eval (C).** X_ITE compiles the `ecmascript:` source with string evaluation, so under no-eval the tesseract freezes and a console error is logged.
   - Fix: a **SAI twin.** The page reads a field the Script drives, reads it again 2.5 s later, and if it has not changed, runs the same mathematics through the SAI every frame. The twin is gated by a **motion witness**, not by catching the error.
4. **The tangent generator's WASM is refused (C, harmless here L).** `generateTangents` fetches `mikktspace_bg.wasm` and rejects with `Failed to fetch`, an unhandled promise. Nothing in this scene uses normal maps, and every frame was complete. A scene with normal maps might differ (S).
5. **The host refuses the `.x3d` extension (C).** The page host serves `.xml`, and X_ITE loads `landscape.x3d.xml` by content. The page tells readers to save it as `.x3d`.
6. **The local rig refuses a cross-origin loopback (C, rig only).** Chrome's Local Network Access blocks a page on `127.0.0.1` from loading a script on `localhost` ("Permission was denied ... loopback address space"). Emulating a CDN locally needs `--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks`.

## 3. What the scene taught

1. **Valid is not visible, again (C).** The file was XSD-valid from the third build. The frames then caught six faults no validator can see:
   - station titles clipped above their own views;
   - the Materialism camera standing beside station 2's title;
   - labels from neighbouring stations crowding every view (LOD 60 → 36);
   - runaway hills at the grid corners (`max(0, r − 62)^1.35` gave about 55 m at the corners, by the formula);
   - the river camera riding through the bead helices;
   - Challenge labels missing from their own view (item 3).
2. **A palette lifted from a print figure failed colour-blind separation (C).** The figure's ten family colours, lifted for a night ground, failed G4: the closest pair under deutan or protan simulation was 0.027, against a need of 0.04 (Machado 2009). They also failed G6: a white alert sat 0.129 from the silver of Challenge, against 0.15.
   - `repair` moved orange and lime by lightness only. Challenge's silver became a cooler grey by hand.
   - The grammar caught this before anything was drawn, so it never reached a frame. Neon Noir (failure mode 214) failed the same rule with 8 colours; 10 is harder.
3. **LOD measures from the eye even under an OrthoViewpoint (C).** The ortho view of Challenge framed its beads closely, yet their labels were hidden, because the camera stood 60 m away and the label LOD switches at 36 m. Moving the camera from 60 m to 24 m along the same axis, and the beads 10 m toward it, brought the labels back. Under orthographic projection neither move changes the framing.
4. **A standpoint object can be built exactly (C).** The Penrose tribar is three real bars, P0 → P1 → P2 → P3, with P3 = P0 + L(1,1,1).
   - The near bar is clipped by the two planes through the far corner cube's hexagon edges that contain the view direction. The cut faces are then edge-on to the eye. The clip is kept as two convex pieces, A, and B minus A, so no area is drawn twice.
   - Under an OrthoViewpoint along (1,1,1) the triangle closes with no visible seam. Seen from any perspective view, it comes apart.
   - Unlit per-axis face colours keep near and far bars shaded identically.
5. **A twisted band closes only after measuring its holonomy (L).** A parallel-transport frame carried once around the trefoil comes back rotated by an angle that has to be measured. The band's twist is set to 3π minus that angle, giving three half-twists and one surface. It looked closed in every frame; the seam was not measured.
6. **An MFNode proto field carries USEd geometry in X_ITE (C).** Each Thinker's label is passed as an `MFNode` `fieldValue` holding Transforms of `<Shape USE>` from the glyph library, IS-connected to a Billboard's children. This works, where an `SFNode` field holding a `USE`d texture did not (LEARNINGS-xite-inline-shaders, item 2). The difference may be MFNode children against SFNode, or geometry against a texture: not isolated (S).
7. **The XSD rejects a lone WindPhysicsModel (C for the XSD, L for the spec).** In the X3D 4.0 XSD, ParticleSystem's physics models form an `xs:sequence` of BoundedPhysicsModel, ForcePhysicsModel and WindPhysicsModel inside a repeat, so each must appear in that order. The spec's `physics` field is an MFNode of any X3DParticlePhysicsModelNode. The wind was dropped instead of padding the scene with placeholder physics.
8. **The validator's semantic layer caught two X3D 3 habits (C).**
   - `ColorRGBA containerField='colorRamp'` was rejected, with `color` suggested.
   - Vertex colours from summed noise ran past 1.0 (19 components): out-of-range colours, now clamped at write.
9. **Earlier Loom lessons held (C).**
   - `data:x-shader` prefixes on both shaders: no magenta fallback appeared in any frame.
   - ROUTEs written after every DEF.
   - Real heights kept in the ElevationGrid.
   - Shape level 5 declared for PointProperties.
   - Style metadata on the root Group.
10. **A motion witness proves behaviour that a file check cannot (C).** Reading `TessCoord.point[0]` twice, 1.5 s apart, showed whether the Script ran: `[1.193, 2.532, 2.312] → [3.200, 2.750, 2.744]`. The same check gates the page's twin.

## 4. Failure modes (proposed rows for LOOM-v1.md §8, renumbered from the kit's 279 to 286 because origin/main held 406 on 26 Nov)

| # | Failure | Rule | Source |
|---|---|---|---|
| 407 | A hosted page drew a black panel: X_ITE hides its view until its stylesheet loads, and the sandbox refused the cross-origin stylesheet; the only signal was a page error reading `Event` | When the renderer comes from another origin, size and reveal its view from the page, and assert the canvas is larger than 0 × 0 after load | [this doc §2.1, C: bisected, CSS unblocked 620 × 576, blocked 0 × 0] |
| 408 | Every label vanished under a same-origin fetch policy, and again under no-eval, because Text needs a font fetch and WOFF2 needs a string-evaluating decoder | For hosted pages draw text as geometry from a glyph library (DEF/USE); for vendored builds ship TrueType bytes | [§2.2, C] |
| 409 | A Script's behaviour stopped under a no-eval policy while the scene otherwise ran | Give each Script that matters a page-side SAI twin, switched on by a motion witness, not by catching the error | [§2.3, C; predicted by trap `no-script-under-host`] |
| 410 | A schema-valid intent failed the XSD: one WindPhysicsModel in a ParticleSystem | Read the XSD content model before adding particle physics; do not pad with placeholder models; report the sequence upstream | [§3.7, C XSD / L spec] |
| 411 | A palette lifted from a source figure merged two families for colour-blind readers (0.027 against 0.04) | Lint any borrowed palette with x3d.style before building; repair by lightness, not by eye | [§3.2, C] |
| 412 | Labels were missing from an orthographic view that framed them closely | LOD measures from the eye even under OrthoViewpoint: place the ortho camera within the LOD ranges, or derive the ranges from its distance | [§3.3, C] |
| 413 | The hosting service refused the world's file extension and published nothing | Check the host's served types before publishing; X3D XML ships as `.x3d.xml` and X_ITE reads it by content | [§2.5, C] |
| 414 | A witness suite that already existed was not run until after publishing, and found two page errors and an untested colour blend | Run `traps`, `pagetraps` and `grammar` at the first draft and at every publish | [§1, C] |

## 5. What can be folded back

| # | Target | Change | Evidence ready | Size |
|---|---|---|---|---|
| F1 | `LOOM-v1.md` §8 | Add rows 407–414 above; recount with `mascot/loom_counts.py` | this doc | small |
| F2 | `kit/loomkit/traps.py` | New rule **`text-needs-font-fetch`** (warning, hosts `strict` and a new `sandbox`): any Text/FontStyle, with the advice of 408. Two-sided: a scene with Text must hit, and the same scene with glyph geometry must not | this world before and after the glyph change | small |
| F3 | `kit/loomkit/traps.py` | New rule **`lod-under-ortho`** (info): an OrthoViewpoint whose distance to an LOD's centre exceeds that LOD's first range | §3.3 numbers (60 m vs 36 m) | small |
| F4 | `kit/loomkit/traps.py` | `loop-seam` accepts a declared restart: `MetadataString name='loom:seam' value='"restart"'` on the interpolator. Alternatively, change the scene to hide the jump (scale the pulse to 0 at the tip) | 10 hits in §1 | small |
| F5 | `kit/loomkit/pagetraps.py` | New rule **`xite-css-gate`** (warning): the page loads `x_ite*.js` from another origin and never writes to the canvas's `shadowRoot` or clears `display:none` | §2.1 | small |
| F6 | new witness `kit/loom host` + profile `x3d-hosted-page/v1` | Run the page with the renderer on a foreign origin under the hosted CSP, then record canvas size, a motion witness per animated field, frames per viewpoint and console or page errors. The emulation scripts exist (`page_cdn.mjs`, `bisect.mjs`, `shoot.mjs` in this session's rig) | §2 runs | medium |
| F7 | kit module `x3d-glyphs` (from `glyphs.py`) | Text as geometry: TTF → flattened, earcut-triangulated glyphs → a DEF/USE library. Usable by any Loom scene builder | this world: 118 meshes, 2,363 uses | small |
| F8 | `x3d.style` | New token `type.render: text \| geometry` (49 tokens), compiled by `compile.mjs` through F7, and the OWL/SKOS/SHACL vocabulary regenerated from `PARTS` | §2.2; changes the vocabulary, so it needs the owner's word | medium |
| F9 | `x3d.style/styles/authored.jsonld` | Add `xst:kuhn-landscape` as the 13th style: the first borrowed from a source figure, 10 categorical colours, with its authored lint failure kept as a test | `kuhn-landscape.style.json` (authored, final, both lint records) | small |
| F10 | `SCIENCE-PLAYBOOK.md` witness patterns | **Motion witness**: sample a driven field twice through the SAI; a constant value is a failed behaviour, whatever the console says. **Standpoint witness**: an object that must close from one view is framed from that view and from one other; it must close only in the first | §3.4, §3.10 | small |
| F11 | `GLOSSARY.md` | *SAI twin*, *motion witness*, *standpoint object*, *glyph library*, *hosted page* | this doc | small |
| F12 | upstream (Web3D X3D 4.0 XSD, through the x3d_mcp fork's schema) | Report the ParticleSystem physics content model (§3.7) | XSD excerpt + one-node test file | small; needs the owner |
| F13 | x3d.demo | Publish the world as a demo with its frames receipt, **after** fixing the two `xite-callback-unguarded` errors and budgeting `loadURL` | §1 | small |
| F14 | `LEARNINGS-xite-inline-shaders` | Add the contrast in §3.6 (MFNode USEd geometry works; SFNode USEd texture did not) as a lead for isolating that cause | §3.6 | trivial |

**Order, if all are wanted:**
1. F13's page fixes, then F1, F2, F5, F7 and F10: they touch nothing others depend on.
2. Then F6, which uses F5.
3. Then F8 and F12, which need the owner's decision.

Under the owner's kit rule (one kit per repo, on main), F1–F7, F10, F11 and F14 are one x3d.loom kit, F9 another, and F13 one x3d.demo kit.

## 6. Not done, and why it matters

- **No receipt.** The world was not accepted under `x3d-static-v3` and no `receipt` was written: the frames were never recorded as a witness, and the page fails `pagetraps`. The grades above come from the witness files in `run/evidence-*` and this session's frames, not from a receipt.
- **No hardware GPU and no frame of the real hosted page.** The hosted findings come from an emulation whose CSP was written from the host's published rules, not read from the host.
- **Not measured:** the band's seam, the HSV-against-RGB mote colours (§1), and whether the WASM refusal matters for a scene with normal maps.
- **The transcription has one reader.** A second reading of the figure (another person, or OCR at higher resolution) would make it a witnessed transcription instead of an authored one.
