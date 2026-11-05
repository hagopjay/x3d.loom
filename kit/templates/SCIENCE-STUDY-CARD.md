# Science study card

Fill this in **before** the first build. Copy it to `docs/CARD.md` in the study. A field left empty is a decision not yet made; say "none" when the answer is none. The patterns are in [SCIENCE-PLAYBOOK.md](../../SCIENCE-PLAYBOOK.md).

## 1. Question and audience
- The one sentence a visitor should leave with:
- Lenses (Explorer, Lab, Instrument, Theatre) and what each adds:

## 2. Model
- Equations, units, domain, boundary conditions:
- Method (scheme, expected order of convergence, stability bound):
- Stated limits (what the model leaves out; at least one):

## 3. Exact references (at least one)
| Reference | Closed form or exact discrete identity | Where it is computed | Declared limit |
|---|---|---|---|
|  |  |  |  |

## 4. Claims the captions will make
| Word or number in a caption | Measured how | Threshold (declared now) |
|---|---|---|
|  |  |  |

## 5. Exploration (before declaring limits)
- Easy case results:
- **Worst case named and run** (cusp, curved domain, symmetric or dark view, chaotic case):
- Numbers that set each limit (copy them into the builder's docstring):

## 6. Witnesses
| Witness | Pattern (playbook §2 A–I) | Limit | Negative control that must fail |
|---|---|---|---|
|  |  |  |  |

## 7. Display chain
- Encoding and precision; the quantization witness in the study's own units:
- Clipping and transfer range:
- What the browser recomputes and must match exactly:

## 8. Page contract (law 32)
- [ ] Payloads verified before use (compressed and decoded hashes)
- [ ] `loadWorld()` with a time budget; navigation wired after the scene loads
- [ ] Playback through `TimeSensor → IntegerSequencer → Switch`; `getCurrentTime()`
- [ ] Every field callback guarded with try/catch (inside a callback passed by name too); resilience probe in the browser evidence
- [ ] Page traps given every file that runs page code (`src/*.js,index.html`), with non-zero `seen` counts
- [ ] Every component declared; viewpoints TELEPORT before captures
- [ ] A read-only view report and deep links

## 9. Acceptance
- Profile name and required witnesses:
- What stays visibly not run (GPU, host, paired review, listening):
