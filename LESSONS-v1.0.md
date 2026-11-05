# Loom v1.0: the lessons, swept up

5 November 2026. The plain-language companion to [LOOM-v1.md](LOOM-v1.md) v1.0: what three days of consolidation, the other models' project deliveries (loom, loom2, the Scientific Loom, loom4), six x3d.STEM flagships built under the Loom, and the loom4 delivery taught. Each lesson points at the law (§3) and failure modes (§8) that hold its evidence.

**For the next science or maths study:** start from [SCIENCE-PLAYBOOK.md](SCIENCE-PLAYBOOK.md) and `kit/templates/SCIENCE-STUDY-CARD.md`.

**The one-line version.** Most of the work went into making checks trustworthy, not into making them pass. A green row is worth exactly as much as the witness behind it, so the witness is tested first.

## 1. About witnesses: the heart of the Loom

1. **Suspect the witness before the subject.** Most surprises were instruments measuring the wrong thing:
   - Kerr 2's "GPU bug" was a capture of the wrong view mode.
   - The Turing Garden's quantization check returned the same 0.31 cells in every case and at both 8 and 16 bits, so it was measuring mesh convergence.
   - The Chirp ear check and the heart's pacing check compared unlike things.

   The tell: a number that doesn't move when its supposed cause changes. *(Law 26; failure modes 64, 70, 79.)*
2. **Compare like with like, and state the witness exactly where the construction allows.**
   - A windowed pitch against an instantaneous frequency was wrong twice before it became an exact crossing count.
   - A paced beat against a beat into rested tissue was 4 % "wrong" until first beat met first beat (0.002 %).

   *(Law 27.)*
3. **Every witness carries a control that must fail.** These controls caught weak evidence before it became a false green:
   - a signal floor (a black frame matches anything);
   - a flipped image (it failed to fail on a mirror-symmetric view, so the view changed);
   - a 2 % sped-up audio track.

   *(Law 19; failure modes 65, 66.)*
4. **One witness, one cause.** When a check mixes two causes, split it. Quantization and the mesher's convergence became two witnesses with two limits. *(Failure mode 70.)*
5. **Valid is not visible, in both directions.** Tether's cohort: 17 of 91 "valid" scenes rendered blank, and 10 invalid scenes still drew. Grammar, Meaning and Eyes stay separate witnesses. *(Law 2; failure mode 91.)*
6. **Evidence is bound to exactly what it judged.** Browser evidence records the hashes of the page sources and case manifests it ran against, so a later edit makes it stale automatically. Checkers print the hash of the evidence they read, because the Loom skips folders named `evidence` when it hashes a project (open question 14). *(Law 17; failure mode 74.)*
7. **Two implementations are a witness; one implementation twice is not.** Every study's page re-meshes the verified fields in JavaScript and must match Python's counts and volumes exactly. That caught porting slips as red rows, not as subtly wrong pictures. *(Law 25.)*

## 2. About limits and causes

8. **Explore the worst case before declaring a limit.** The Electron Cloud's normalization limit was set on easy orbitals, and 3s broke it. *(Law 28; failure mode 76.)*
9. **Fix the instrument, not the threshold.** Refinement proved the 3s deficit was resolution, so normalization moved to a finer check grid with the same limit. The red run stays in `evidence/history/`. The colour gate in Kerr 2 was fixed with the official CIE table, not a wider tolerance.
10. **Change one thing at a time to find a cause.** The fast vortex ring was not the boundary I blamed. Changing only the box size revealed the periodic images, and my first correction had the wrong sign. A correction fitted this way is grade L. A number that depends on the analyst's fitting window is reported, not gated. *(Law 29; failure modes 86, 87.)*
11. **Precision is chosen to meet the witness.** The Turing Garden publishes 8-bit fields unless the declared shift limit fails, then 16-bit for that case alone. *(Law 23; failure mode 71.)*

## 3. About science

12. **Use exact answers even when the problem is solved.** Hydrogen's −1/(2n²), the Nagumo front speed, Peters' decay laws, Bogoliubov sound and the linear-mode decay of every scheme all made the solvers prove they converge, at the observed order they should (2.000, 2.05, 2.0006). The observed order is itself a witness.
13. **Invariants admit; they do not confirm.** Conserved norm and energy rule a run in. A separate witness must test the event the study promises: topology for a reconnection, morphology for a garden's name. *(Law 21.)*
14. **Nothing transfers across dimension or geometry unmeasured.**
    - A 2D seed died in 3D, and a symmetric seed drew fake patterns.
    - "Labyrinth" became sheets in 3D.
    - A broken-wave start died on a curved ventricle.

    Every name in a caption is a measured claim. *(Law 30; failure modes 67–69, 82.)*
15. **Topology before claims.** The page may say "reconnection" only because two grids agree on the loop sequence and event times. That was the Scientific Loom's open gate, now closed.

## 4. About the browser and X_ITE

16. **The runtime's contracts are part of the build** *(law 32)*.
    - **Callbacks:** one exception escaping an X_ITE field callback freezes every route in the scene. This was reproduced in 16.5.1 (failure mode 88; the teardown's F02).
    - **Clock:** use `getCurrentTime()`, never `currentTime`.
    - **Navigation:** wire it only after the scene loads.
    - **Components:** declare every component (PhysicalMaterial needs Shape 2).
    - **Waiting:** put a time budget on world loads (F01).
    - **Viewpoints:** switch them instantly before capturing evidence.
17. **One clock, one owner.** Chirp's picture and sound drifted up to 1.5 s apart until the audio drove the picture, and the evidence compared the two clocks. *(Law 31.)*
18. **Read your own checklist.** The X_ITE clock trap was already in the kickoff notes and was hit anyway. *(Law 33.)*
19. **Small code habits corrupt evidence.** Each of these lost or misstated data without any error:
    - a key allowlist in `JSON.stringify` deleted nested fields;
    - a cache keyed on item count missed same-size edits;
    - report prose said one disagreement where the data had two.

    So generate report numbers from the data, as `stemkit.docs --numbers` does. *(Failure mode 90.)*
20. **Ordinary names can break things.** `tools/numbers.py` hid Python's `numbers` module, and a page global named `top` collided with `window.top`. A stemkit test now refuses standard-library names. *(Failure modes 75, 77.)*

## 5. About process

21. **Every result states its scope and its level.**
    - **Scope:** what it is not ("physics CPU only, not frame rate"; "browser WebGL not verified").
    - **Level:** within grade C, whether it was reproduced in isolation (L2), in a real browser (L3) or with a comparative measurement (L4).
    - **Confidence:** confidence in a source fact is kept apart from confidence in its consequence.

   *(Law 34; from the X_ITE teardown.)*
22. **A signature proves a key, not an author.** Loom receipts stay unsigned until signing binds the validator build, canonicalization, report hash and scene hash under an independently pinned key. *(Law 35; from Tether.)*
23. **Fold back small, add layers, never send without "send".** Lessons returned as additions-only patches with their counterexample (PRs #10–#17, none merged by the agent). Every receipt and red run is kept. Nothing was pushed or sent without your word. *(Laws 14, 16, 20.)*

## 6. What v1.0 contains

- **[LOOM-v1.md](LOOM-v1.md):**
  - 35 laws;
  - the ten-step loop;
  - 91 failure modes, each with its fix and source;
  - acceptance profiles for the Scientific Loom and each x3d.STEM study;
  - the roadmap, including the X_ITE fixture catalogue.
- **`kit/loomkit`:** candidate binding, Grammar and Meaning on the x3d_mcp fork, 11 trap rules, science gates (builder and dependency hashes, payloads opened before they are hashed), receipts, a leak sweep. Page traps add six more two-sided rules (syntax, guarded callbacks, clock, navigation, globals, load budget). 44 negative controls pass, normal and under `python -O`.
- **Receipts in `runs/`** for Data City, the fold-backs, the Scientific Loom, and all six x3d.STEM flagships:
  - Kerr 2;
  - Turing Garden (re-accepted after its loading-race fix);
  - Electron Cloud;
  - Chirp;
  - Living Heart;
  - Vortex Reconnection & Sound.
- **The demo page** (http://127.0.0.1:8800/, started by `projects/run_all.sh`): 85 items in 13 groups, every one reachable.

## 7. Open before 1.0 is frozen

- **Question 14** in LOOM-v1.md: exclude the Loom's own evidence directory by path, not by name (a versioned change to candidate hashing).
- ~~Wrap callbacks in the five accepted study pages.~~ **Done 5 Nov:** all six pages hardened (guarded callbacks, budgeted world loads, navigation after the scene). A new `page-traps` witness (6 rules, including a syntax check) is required by every x3d.STEM profile. Each page's browser evidence now includes a resilience probe, and all six are re-accepted.
- **X_ITE versions differ across deliveries:** 16.5.0 (Tether), 16.5.1 (x3d.STEM), 16.6.1 (the teardown) and 16.7.0 (the MuJoCo bridge). Pin one for v1.0 fixtures and re-run EVT03 (failure mode 88) on it.
- **Signing receipts** (law 35) is a design decision for you, not a default.
