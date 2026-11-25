# The Gobbler swarm: 30,000 LangGraph replicas on the flywheels (24 Nov 2026)

Demo 23 version 2, x3d.demo `docs/demos/gobbler-gyroscope-webgpu/v2/` (PR 175). His ask, 24 Nov: keep the v1
gyroscope's look, push the visuals and VFX, and put signals of the Gobbler's LangGraph agents on the flywheels
"more like 3000, or even 30,000". His picks: 30,000 by default with a slider past 100,000; one agent = one full
replica of the Gobbler.flyte graph riding its loop's hoop, position = stage; behaviour replayed from recorded tapes.
No model was called and nothing was spent.

Rig for every number here unless named: Chrome for Testing 158.0.8127.36 headless with SwiftShader (a CPU
rasteriser, not a GPU), and Node 22.23.5 on the build container (Xeon @ 2.10 GHz, 4 cores). Grades: C Confirmed,
L Likely, S Suspected.

## 1. Calibrate a swarm from tapes, and say what the tapes are

`source/calibrate.py` reads the five recorded sim days in x3d.gobbler (`flyte/runs/sim-2026-11-18*/tape.jsonl`,
x3d.gobbler at `cd95382`) and writes every branch probability with its counts and the tapes' sha256 (C):
signal 175/240, first pass 90/175, second pass 40/85, ask 40/175, answered 12/32, refusal codes 45/45/40 of 130,
hold 0/175, $0.000544 per simulated weave. The five tapes replay the same fixture day, so this is one day seen five
times, not five days; the page and the README say so. A swarm that looks alive is not evidence of anything until
each of its probabilities points to a row count.

## 2. Integer state machines make a GPU twin checkable bit for bit

Each replica is four u32 (packed stage/loop/attempt/flags, tick, duration, PCG32 state); thresholds are p x 2^32,
durations are integer ticks. The JavaScript reference and the WGSL compute kernel then produce the same bytes:
FNV hash of all state equal at 4,096 x 600, 30,000 x 400, 131,072 x 200 ticks and 30,000 x 300 with chaos 0.6,
and all event counters equal (C, 4 of 4). Floats in the update would have made "close enough" the only possible
claim. The same model.js then drives the WebGL2 fallback on the CPU, so all three paths share one truth.

## 3. A windowed KPI must not count the time before the first readback

The live panel compares each rate to the recorded one and marks it within 3 binomial standard errors. The first
build flagged false misses: its rolling window started before the GPU's first counter readback, so the window held
zeros and the warm-up crowd. Skipping samples until the first readback and printing "warming" until the window
spans 8 s fixed it (C: first pass 51.6% live against 51.4% recorded after the fix). At 100,000 replicas in capture
mode, with only three readbacks in 16 s, two rows still show amber (C, shot s5); the steady-state run is the check
to quote, the live table is a dashboard.

## 4. Headless SwiftShader cannot present a WebGPU swap chain

In this rig the device is lost on the first present to a canvas context; v1 of the same page does the same, and it
is not limits, post-processing or the scene (C, bisected with probe pages). Compute and offscreen render work, so
`?capture=1` renders to a texture, copies it to a buffer, and paints a 2D canvas, paced on the readback so map
requests do not pile up. Every WebGPU screenshot in v2 is a capture frame and the README says so. This is a test
rig limit, not a claim about real GPUs.

## 5. Share the page's GPUDevice and buffer instead of copying matrices

On WebGPU the swarm uses Babylon's own `GPUDevice` and binds the page's kinetics storage buffer (10 hoops x
80 bytes) directly, so replicas ride the hoops' real matrices with no CPU round trip. Its final pass writes alpha
0 over a transparent canvas, so the compositor adds the swarm's light onto the scene. Shown against a stand-in
Babylon body (shared device and buffer bound, 297 frames, C); against the real scene on a real GPU, not yet seen.

## 6. Smaller things

- `pass` is a reserved word in WGSL; a variable named `pass` fails the whole module (C).
- 30,000 additive comets white out at the first exposure. Agent gain scales as 0.10 x sqrt(30,000 / n) and the
  bloom threshold sits at 0.35 so the hoops' colour survives the crowd (C by eye, shots s1 and s5).
- Starting every replica at the start line shows a parade, not a fleet. A 900-tick warm-up and a random first
  idle of 1 to 420 ticks put the swarm at steady state before the first frame (C).
- A "needs WebGPU" wall is a dead end on his machine (UHD 620 blocklisted). The fallback now draws instead of
  apologising (C in the rig with `navigator.gpu` removed).

Failure modes 260 to 265 in LOOM-v1.md section 8 come from this lane.

## v3, the pipeline layer (24 Nov 2026)

His ask, after seeing v2: "a light UI layer showing textual and small imagery and iconography ... signaling the pipeline
is dynamic and progressing at hyper-speeds". x3d.demo `gobbler-gyroscope-webgpu/v3/` (PR 177). Same rig as above.

### 7. A "live" event feed must be fed by real events

The easy way to make a feed look busy is to invent lines at a plausible rate. v3 instead reads replicas #0 to #1,023
back from the GPU with the counters (one extra 16 KB buffer copy per readback; the WebGL2 path takes the same replicas
from the CPU twin) and diffs consecutive readbacks. Every line names a real replica, its flywheel and its real
transition (C). The feed shows about 12 lines a second, weighted towards refusals, asks, admissions and holds, and its
header says how many were seen and how many shown. A change is stamped somewhere between the two readbacks that bracket
it, and the README says so. Because the GPU and JS twins are bit-identical, a sentinel's history can also be replayed on
the CPU if anyone doubts a line.

### 8. A speed-up claim must be measured, not nominal

"x134" is true only when the machine steps 30 ticks a second. The clock advances by the ticks the swarm actually
stepped, and the panel prints the measured factor next to the nominal one. In the software rig it read x2 to x18
(C, shots); on a stall it reads x0. A hyper-speed display that keeps its nominal number on a slow machine is the same
failure as a typed count.

### 9. Smaller things

- Rates computed from the last two counter samples read 0 on a slow rig: two samples can hold the same readback. The
  window must reach back past the last sample that holds the same readback (C: rates 0 before, 300/s after).
- An expected fallback logged with `console.error` looks like a crash to anyone reading the console; v3 logs the
  no-adapter path as information (2 errors in v2, 0 in v3, same rig, C).
- A README's hash table went stale when the model changed after the parity run: v2 lists hashes from an earlier build;
  re-running its own parity page gives other hashes, still bit-identical on both sides (C). Re-run the receipt after
  the last change, or print hashes from the test page into the README by script.
- A stream whose backlog is picked at random shows times going backwards. Replace the backlog at each readback and pick
  only among the next few in time order.

Failure modes 266 to 269 come from v3.

## v4, the Ouroboros (25 Nov 2026)

x3d.demo `gobbler-gyroscope-webgpu/v4`: a serpent of 60,000 sprites around the swarm (raw, structured, Assayer gate,
knowledge, a staged Blender sci-viz lens, action, the bite), two nested serpents at the bite, and a panel fed by live
swarm counters plus a recorded data file. Rig for every C below: Chrome for Testing 158.0.8127.36 headless, SwiftShader.

### 10. An overlay canvas that borrows the camera works over either backend

The serpent is one WebGL2 canvas over the swarm (additive, transparent clear). It reads the host's view-projection
matrix each frame and places every sprite in the vertex shader from a per-sprite seed, so there are no per-frame
uploads and no dependence on whether the swarm underneath draws with WebGPU or WebGL2. C for the solo page on WebGPU
(through `?capture=1`) and for the page's WebGL2 fallback. Suspected only for the integrated page on a real GPU, where
the swarm draws on Babylon's device: that path cannot present in the rig, so the overlay there has not been seen.

### 11. "0 console errors" missed a HUD that threw on every frame

A label helper used a variable from another function's scope and reassigned a `const`. The panel went blank and all
labels stacked at the top-left corner, yet the error watcher printed nothing: it listened for `console` messages of
type error, and an uncaught exception arrives as a `pageerror` event instead. The screenshot caught it; the watcher
now listens for both (C).

### 12. Draw a planned organ as planned

The owner asked for the Blender sci-viz agent on the picture; it is not a node of the graph yet. The lens is drawn on
the serpent where it would sit, labelled "staged, not yet an organ", with no counter, and the panel lists only what a
person has rendered by hand, from the render receipts. Likewise the funnel marks every row that is a live counter
times a recorded ratio with ≈ and names the ratio, and the README says the swarm model has no fold-back step.

### 13. Smaller things

- A counting script run inside a working branch counted that branch's unmerged entries. Detach the checkout at
  `origin/main` first and write the commit beside the counts (C: the first data build ran on a local branch).
- Sprite density on a diagram reads as quantity. The page says the density is a picture and puts the counts on labels.
- Copying a version folder forward carries the old screenshots; stage the new folder file by file.

Failure modes 270 to 273 come from v4.

## v5, the Gobbler returns (25 Nov 2026)

x3d.demo `gobbler-gyroscope-webgpu/v5`: the glass Gobbler's own faces as the serpent's head, a ring of 27 graded lanes
feeding the serpent, a flywheel board, a spotlight card and a fact strip. Same rig as above for every C.

### 14. Grade a vision before drawing it

The owner listed what the Gobbler should become (ontology, skills, engine profiling, adversarial injection, DSPy, the
Assayer, graph RAG, vision, a DevTools MCP, Blenderizer IO 4.0, XR, the Loom, bridges to URDF, physics, AEC, Bonsai,
OpenUSD, Omniverse). Drawing all of it at one brightness would have been a claim. Each lane got one of five grades
(live, built, touched, planned, envisioned), the builder requires an evidence path in a public repo for any grade above
envisioned and stops if the path is missing, and unstarted lanes are drawn dashed. Result: 3 live, 9 built, 7 touched,
3 planned, 5 envisioned. The evidence paths existing is C; the grade chosen for each lane is a judgement (Likely).
Stream density shows the grade and is labelled as not a measured flow.

### 15. A mesh as additive points is a blob; as rim-lit triangles it is glass

The first bird was 40,000 sprites sampled on the mascot's faces. Additive light with no depth buffer turned it white.
The second draws the mascot's 11,736 triangles additively with brightness (0.45 + 1.6 rim), rim = (1 - |n.v|)^2 from a
per-face normal, and keeps points for gems, heart, eyes and a few sparks. The fan's feathers then read as coloured
panes (C by eye in the rig's shots; no real GPU).

### 16. Two more ways a clean console lied

- A set-up call ran before the element it writes to existed. The error was caught by the module's own try block and
  logged with `console.warn`, so the watcher (console errors plus page errors, added in v4) printed nothing while the
  strip, the labels and the spotlight were missing. The watcher now prints warnings; the better check is to assert the
  elements exist (C).
- `git log --since=2026-11-18` gave 267 commits, then 265 an hour later: git reads a bare date as that date at the
  current time of day. Pinned to `T00:00:00+00:00` it gives 273, twice (C).

### 17. Smaller things

- A recorded object does not grow on a page. The glass bird was built at Loom 139896f and wears 228 failure-mode
  beads; the Loom had 273 when v5 was built. The page shows the current count in the strip and the README says the bird
  is a record.
- Counting pull requests by a "(#n)" suffix on commit subjects found 5 of 77 on x3d.loom. Dropped rather than shown.
- Labels on two rings collide. One pass that steps a lane label above or below any station label it overlaps was
  enough at 27 + 7 labels (checked by eye only).

Failure modes 274 to 277 come from v5.
