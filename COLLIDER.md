# The Loom Collider: a collider-event demo in X3D

Date 2026-11-06. Status: spec and first light. **A demo, not STEM:** the physics only has to be plausible, and the effort goes into graphics. Every particle gets its own animated shader look, and the X3D file is still one an AI can be held accountable to.

Grades follow the Loom: **C** is measured here with the named instrument, **L** is read or reasoned from sources, **S** is suspected.

## The pipeline (the zinc-finger route: reference film, truth audit, X3D rebuild)

```
 look target                truth audit                 generator                     candidate                    witnesses
 hosted image and video  -> keep: end-on view,       -> Pythia 8 pp events        -> scene builder              -> hep-event (plausibility)
 models make a hero still   loopers, crown;             (13.6 TeV, committed         build_event_scene.py          traps (11 known traps)
 and an 8 s film (private)  fix: only muons pass the    fixtures, plus pile-up)      --look v1 | --look v2          receipt, acceptance under
                            calorimeter, tracks curve   + truth-level toy             (one DEF'd shader per role,   hep-demo/v1
                            by pT, crown follows the    response (hep_response.py)    per-vertex identity)         render: X_ITE stills
                            energy, colour = meaning                                                                (frames-v2, 0 errors)
```

The reference media and their ledger are private: they stay off this public snapshot. Only what was built from them is here.

## What is here

| path | what |
|---|---|
| [docs/HEP-EVENT-WITNESS.md](docs/HEP-EVENT-WITNESS.md) | The witness: event format `loom.hep-event/1`, spec, ten stable codes, controls, findings from real generator output, limits |
| [docs/COLLIDER-XITE-FEASIBILITY.md](docs/COLLIDER-XITE-FEASIBILITY.md) | X_ITE 16.5.1 measured: load matrix, a shader on every particle at 300 and 3,000 tracks, the zero-area crash trap, transparency, the freeze trap, picking, glTF, the look recipes (GLSL that rendered) |
| [docs/COLLIDER-SURVEY.md](docs/COLLIDER-SURVEY.md) | Survey of generators, detector toolkits, event formats, open data and event displays, each graded |
| [runs/hep-demo-20261106/frames-v2/LOOK-V2.md](runs/hep-demo-20261106/frames-v2/LOOK-V2.md) | First light: 14 stills, load times, pixel statistics against the target, what still differs |
| `kit/loomkit/hepevent.py`, `kit/loom hepevent` | The witness (standard library) |
| `kit/examples/hep/` | Scene builder (look v1 and v2), exact events, Pythia converter, toy response, fixture selection, four committed fixtures, the spec |
| `kit/examples/hep/render/` | Stills harness (`fetch_xite.sh`, `shots.cjs`, `site/shot.html`) |
| `kit/examples/hep/feas/` | The feasibility harness and generators behind the measurements |
| `kit/profiles/hep-demo.json` | Acceptance profile `hep-demo/v1` |
| `kit/examples/run_hep_event.sh`, `runs/hep-demo-20261106/` | The rehearsal and its receipt |

## Results

| claim | number | instrument | grade |
|---|---|---|---|
| the witness catches what it should | 155 negative controls, each with its intended code and reason; 15 positive; 2 CLI | `python3 -I kit/tests/test_hepevent.py`, normal and `-O` | C |
| look v2 is witnessed, not exempt | 43 of those negatives target the merged convention (deleted strip, duplicated strip, a USE of the set, a hidden set, a collapsed ribbon pair, a hadron drawn through the calorimeter, a muon left inside, a tower energy that lies, and more) | same | C |
| every gate has a control | 127 of 127 `need(...)` sites caught when disabled one at a time (the first pass over the look v2 gates missed 14; 13 controls were added and one dead gate removed) | `kit/tests/mutate_hepevent.py` | C |
| the rehearsal accepts and the gates bite | accepted under `hep-demo/v1` with 8 events and 8 scenes (look v1 and v2); a stale edit, a track deleted in v1 and a strip deleted in v2 all reject | `kit/examples/run_hep_event.sh` | C |
| a shader on every particle | 8,855 tracks of a 24-collision pile-up drawn with 9 shader programs in the page, 0 errors, load 9.9 s CPU | X_ITE 16.5.1, headless Chromium, software GL | C |
| the hero event loads fast | 497 tracks, 132 towers: about 1 s CPU, 9 programs | same | C |
| it looks like the target | magenta 12% vs 13%, orange 4.5% vs 7.5%, crown and framing matched; blue over, cyan under | `imgtools.py stats`, and eyes on every frame | C for the numbers, S for "beautiful" |
| frame rate | not measured | only software GL ran | none |

## Rules this demo keeps

- One DEF'd ComposedShader per role (tracks, towers, shells, flash, haze), USE'd everywhere; per-particle variation in `FloatVertexAttribute`. X_ITE does not dedupe identical programs, so per-track programs would cost about 15 ms of load each (C).
- Merge geometry: one Shape per track costs 27 s at 5,000 tracks; one merged set costs under 4 s at 3,000 (C).
- Offset ribbon vertex pairs: zero-area strips crash the software renderer from about 33,000 vertices (C).
- Tone-map in the shader; X_ITE's ToneMapping option does not reach ComposedShader output (C).
- Guard every host field callback with try/catch (law 32, reproduced on 16.5.1: routing froze at the 13th event) (C).
- Never quote a software-GL frame rate.

## Phases

| phase | what | state |
|---|---|---|
| P0 | survey, feasibility, witness, spec, reference media and truth audit | done |
| P1 | look v2 from real events, witnessed, rendered | first light (this branch) |
| P2 | the page: one clock, guided camera from the reference film's moves, a corner UI with live per-track data on hover (proxies for picking), bloom on or off | next |
| P3 | Blender theatre: a baked machinery backdrop exported to X3D, the event inside it | planned |
| P4 | a short film rendered from the X3D scene and set beside the reference film | planned |
| P5 | real GPU measurements, then a public demo page | planned |

## Reproduce

```
python3 -I kit/tests/test_hepevent.py            # both modes
bash kit/examples/run_hep_event.sh               # candidate, witnesses, acceptance, receipt, three controls
kit/loom verify-receipt runs/hep-demo-20261106/receipt.json
```
