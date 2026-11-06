# Zinc fingers under the Loom

A Loom v1.0 plan for an x3d.STEM study of zinc finger proteins in motion, with its first instrument. Started 6 November 2026.

- **Status:** plan and instrument only. No protein has been simulated and no scene has been built.
- **What runs today:** the metal-site witness (`kit/loomkit/metalsite.py`), its tests, and a receipt over a synthetic candidate (`runs/zinc-site-20261106/`).
- **Grades** follow law 5: **C** measured here with a record, **L** read in the literature, **S** a reading or a model's output.

## 1. Findings

### F1. A beautiful reference animation fails Truth on five counts

The starting point was a 15 s animation of zinc fingers on DNA (1280 × 720, 24 fps, sha256 `58347831…b1bf3f5`; C, ffprobe). It is a strong style reference and a poor science reference. The animation itself is not in this repository.

| What it shows | What is true | Grade |
|---|---|---|
| Zinc fingers drawn as literal white fingers gripping the helix | A zinc finger is a small fold of about 30 amino acids; the classic Cys2His2 type is two short strands and a helix. The name comes from the finger-like loop in the first drawings | L |
| A silver zinc held by four identical gold ligands | Four-coordinate, roughly tetrahedral zinc is right, but the ligands depend on the class: Cys2His2 is two sulfurs and two nitrogens; a CCCH finger is three sulfurs and one nitrogen | L |
| Fingers wrap double-stranded DNA from the outside | Classic fingers set their helix into the major groove, about three base pairs per finger. The CCCH tandem fingers of the tristetraprolin family bind single-stranded RNA, not DNA | L |
| Red-blood-cell discs drift beside the DNA | Mature red cells have no nucleus and no DNA, and a cell (about 7 µm) is roughly 3,500 times wider than the helix (2 nm) | L |
| Glowing spheres, floating small molecules, a starfield | Nothing they stand for is named; the inside of a cell is crowded water, not open space | S |

The study keeps the look (deep blacks, depth of field, a cool palette, a bright metal centre) and replaces the content with coordinates from a structure or a simulation. Law 2 in a new field: beautiful is not the same as true, and a witness can say exactly where it isn't.

### F2. The simulation stack runs here; the structure archives do not reach here

- An open-source molecular dynamics engine (OpenMM 8.6.1) and an analysis library (MDAnalysis 2.11.0) install and pass their own self-tests on CPU in the agent's machine (C).
- The three protein structure archives tried refused the connection from that machine (C). The first real structures must be fetched by the operator or by the GPU machine.
- So the first witness had to be written and tested on synthetic sites (F3), with the real-structure run recorded as not run.

### F3. The metal-site witness

`kit/loom metalsite ROOT --evidence EV --files 'structures/*.pdb' --spec SPEC.json` checks every declared zinc site in every file and every MODEL frame. It fails closed (law 18) with one stable code per cause:

| Code | Catches | Why it matters for zinc |
|---|---|---|
| `SITE_COORDINATION` | Donor count within the search radius differs from the declared number | The zinc is losing a ligand, or a water has joined (five-coordinate) |
| `SITE_CLASS` | Protein donors in sequence order differ from the declared class (for example CCCH declared, CCHH found) | A parameter set built for one class used on another |
| `SITE_DONOR` | A histidine binds through ND1 when NE2 was declared, or the reverse | The wrong histidine tautomer, a classic set-up trap |
| `SITE_DISTANCE` | A metal–donor distance leaves its window (defaults Zn–S 2.20–2.45 Å, Zn–N 1.95–2.20 Å, Zn–O 1.90–2.30 Å; typical values, L) | A stretched or crushed site that still counts as four-coordinate |
| `SITE_GEOMETRY` | The four-coordinate geometry index tau4 falls below the declared floor (1 is tetrahedral, 0 square planar) | A distorted site |
| `SITE_INTACT_FRACTION` | The site is intact in fewer frames than declared; the first failing frame and its cause are reported | The zinc escapes partway through a trajectory |
| `SITE_UNITS` | The median nearest-neighbour distance is below 0.5 (heavy atoms sit about 1.5 Å apart) | Nanometres read as ångström: a scene ten times too small validates |
| `SITE_NO_METAL`, `SITE_PARSE`, `SITE_SPEC` | The declared metal is missing; a coordinate is not a number; the spec is malformed (including a search radius outside 2.5–3.5 Å, which would sweep in second-shell atoms) | Instrument errors are not passes (law 19) |

**Tests** (`python3 -I kit/tests/test_metalsite.py`, both normal and `-O`, report in `kit/tests/metalsite-last-run.json`; C):

- 13 negative controls rejected with their intended code;
- 5 positive controls pass, including the window edge (2.44 Å passes, 2.46 Å fails) and a 20-frame trajectory;
- 2 CLI controls: the witness record says pass on a clean site and fail with `SITE_COORDINATION` on a drifted one.

The ideal tetrahedron measures tau4 = 1.0004 rather than 1, because PDB coordinates carry three decimals. That is the display chain at work (law 23), and it is far inside any floor a study would declare.

**Rehearsal receipt** (`kit/examples/run_zinc_site.sh`, profile `kit/profiles/zinc-site.json`; C):

- The synthetic candidate (one static CCCH site and a 20-frame jittered copy) is accepted under `zinc-site/v0`, and the receipt verifies.
- Eight witnesses stay visibly not run, with reasons: real-structure, simulation, grammar, meaning, traps, page-traps, behaviour, eyes.
- Controls: an edit after the witness ran rejects with `STALE_WITNESS`; a candidate whose zinc has lost a cysteine fails the witness and acceptance rejects with `WITNESS_NOT_PASS`.
- The same rehearsal passes with `LOOM_PYFLAGS=-O`.

### F4. Two red results while building, both in the instrument's own code (law 26)

1. **A control expected the wrong code.** The drifted-candidate control expected `SITE_COORDINATION`. The witness answered `SITE_INTACT_FRACTION`, because the trajectory file sorts before the single-frame file, and a lost ligand in a trajectory is an intact-fraction failure whose first cause is `SITE_COORDINATION`. The witness was right. The control now asserts both the code and the first cause.
2. **A positive control caught a crash.** Making the intact-fraction message more readable built it eagerly, so it indexed an empty failure list on every intact trajectory. The 20-frame positive control failed at once. The message is now built only when there is a failure. Without that positive control, every clean trajectory would have stopped the instrument (exit 2) instead of passing.

## 2. The study card

The template is `kit/templates/SCIENCE-STUDY-CARD.md`. Empty fields are decisions not yet made.

### 1. Question and audience
- **The one sentence:** a zinc finger is a small protein fold held together by one zinc ion, and which four atoms hold that zinc decides whether the finger keeps its shape and what it can grip.
- **Explorer:** the site, with bonds that glow only while their measured length says bonded.
- **Lab:** tables of intact fraction, RMSD, contacts and per-residue flexibility, each with its run.
- **Instrument:** the witnesses, receipts and the red runs kept.
- **Theatre:** a film rendered in Blender from the same trajectory as the page.

### 2. Model
- **Equations and units:** classical molecular dynamics with a fixed-charge protein and nucleic-acid force field, explicit water, particle-mesh Ewald electrostatics, 300 K and 1 bar. Files are in ångström; the engine works in nanometres.
- **Zinc:** bonded (a parameterised site) for structure and contact questions. Nonbonded (a 12-6-4 ion model) only for questions about metal exchange. The model is named on every number.
- **Method:** velocity Verlet with hydrogen constraints, 2 fs; 4 fs only with hydrogen-mass repartitioning. The expected error in the total energy is order 2 in the timestep.
- **Stated limits:**
  - no bond can form or break, so persulfidation or oxidation is modelled as before and after states, with the reaction itself left to quantum chemistry on a small cluster;
  - hundreds of nanoseconds, not RNA binding kinetics;
  - a bonded zinc can never leave and a nonbonded zinc can leave for the wrong reason.

### 3. Exact references
| Reference | Closed form or exact identity | Where it is computed | Declared limit |
|---|---|---|---|
| Ideal tetrahedron and square plane | tau4 = 1 and 0 exactly | `kit/tests/test_metalsite.py` | ±0.001 (three-decimal coordinates) |
| Units round trip | nm × 10 = Å; a structure written and re-read reproduces its coordinates | Set-up step (P1) | 0.001 Å |
| Deposited structure | Frame 0 reproduces the deposited site distances | Metal-site witness on the prepared system (P1) | 0.001 Å |
| Energy error against the timestep | Velocity Verlet: halving dt cuts the RMS fluctuation of the total energy by about 4 | Short constant-energy runs at 2, 1 and 0.5 fs (P2) | observed order 2 ± 0.1, to confirm in P2: constraint and Ewald tolerances can bend it |

### 4. Claims the captions will make
| Word or number in a caption | Measured how | Threshold (declared now) |
|---|---|---|
| "zinc held" | Metal-site intact fraction | ≥ 0.99 of frames, windows as in F3 |
| "the finger keeps its fold" | Backbone RMSD to the experimental structure after equilibration, per finger | < 2 Å in ≥ 90 % of frames; never claimed for a finger the experiment finds disordered (§5) |
| "contact" | Heavy-atom distance between protein and RNA or DNA | < 4.0 Å in ≥ 50 % of frames |
| "flexible" | Per-residue RMSF, colour bar in Å | fixed transfer range 0–3 Å, clipping counted |
| "binds tighter" or "weaker" | Not from simulation alone | needs the Experiment witness (law 10) |

### 5. Exploration (before declaring limits)
- **Easy case:** the synthetic ideal sites (F3).
- **Published precedent for the worst cases** (L: read through a literature search, to confirm against the papers before P2):
  - an earlier MD study of the tandem-finger RNA complex (1RGO) found that a fixed-charge nonbonded zinc did not keep tetrahedral geometry;
  - even a polarizable zinc model lost coordination at the second finger of human TTP in 1 of 3 100-ns runs, with the ligand histidine turned into a rotamer that cannot bind zinc.

  These are the failures `SITE_COORDINATION` and `SITE_INTACT_FRACTION` exist to catch.
- **A measured fact the Fold witness must respect** (L): by NMR, the second finger of free human TTP is molten-globule-like and folds only on RNA, while both fingers of its relative TIS11d fold without RNA. A run that folds free TTP's second finger is a red result, however stable it looks.
- **Worst cases named, not yet run:** a nonbonded zinc with a neutral cysteine (expected to lose the zinc: the negative control for the whole simulation chain); the spread across the models of an NMR ensemble; a metal swap to iron or cobalt, where published parameters are scarce.

### 6. Witnesses
| Witness | Pattern | Limit | Negative control that must fail |
|---|---|---|---|
| Metal-site (runs today) | A, E | windows, coordination, class, donor, tau4, intact fraction | the 13 controls in F3 |
| Fold | D | RMSD and secondary structure per finger | a run from a scrambled or unfolded start |
| Repeat | B, H | three or more seeds agree within block-averaged error | a single run quoted alone |
| Energy error | A, B | observed order 2 ± 0.1; drift per ns declared | a 4 fs step without repartitioning |
| Units | I | the gross check in F3, then the exact round trip | coordinates divided by 10 (`SITE_UNITS`) |
| Data-true | G | the page recomputes zinc–donor distances from its own interpolator keys and matches the analysis to 0.001 Å | a scene frame shifted by one |
| Experiment | D | contacts present in the deposited structure are kept | a contact list from the wrong structure |

### 7. Display chain
- **Encoding:** coordinates in Å with three decimals (0.0005 Å worst-case rounding). The quantization witness is the change in each zinc–donor distance between analysis and scene.
- **Glow rule:** a bond to zinc glows only while its measured length is under 2.5 Å.
- **Transfer ranges:** fixed and declared; clipped values counted.
- **Recomputed in the browser:** atom counts exactly; zinc–donor distances to 0.001 Å.

### 8. Page contract (law 32)
None of it is built yet. The page will follow the playbook skeleton:
- trajectory frames verified by sha256 before use;
- playback through `TimeSensor → IntegerSequencer → Switch` for discrete frames, or a `CoordinateInterpolator` for smooth motion, started with `getCurrentTime()`;
- guarded callbacks;
- page traps given every file that runs page code.

### 9. Acceptance
- **Now:** `zinc-site/v0` requires the metal-site witness only.
- **Next:** `zinc-finger-md/v0` adds simulation, fold, repeat, energy error, grammar, meaning, traps, page traps and behaviour.
- **Visibly not run until it exists:** eyes, paired visual review, and Experiment, which needs measurements from outside this project.

## 3. Phases

| Phase | What | Done when | Compute |
|---|---|---|---|
| P0 | Instrument: metal-site witness, tests, rehearsal receipt | this page (done) | CPU |
| P1 | Real structures in: a CCCH tandem finger bound to RNA (an NMR ensemble) and a classic Cys2His2 finger bound to DNA; the metal-site witness on every deposited model | every site passes or its failure is explained | CPU |
| P2 | Short runs of one finger: the energy-error order, the units round trip, and the worst case (the nonbonded zinc that should escape) | the worst case fails for the intended reason | CPU |
| P3 | Production runs, three seeds per system, bonded zinc | fold, site and repeat witnesses pass | GPU, needs the operator's yes |
| P4 | Metal swaps and the persulfidated cysteine as before and after states; the reaction itself on a small quantum cluster | each comparison names its model and grade | GPU or CPU, needs the operator's yes |
| P5 | X3D scenes from one generator (Site, Complex, Compare) and the page | grammar, meaning, traps, page traps, behaviour | CPU |
| P6 | The film in Blender from the same trajectory | the operator's eye, paired with the page | GPU |

Each phase stops and shows its pictures before the next starts, because the biggest risk is a convincing wrong picture, not a crash.

## 4. Fold back

This repository is a public snapshot of a private working repository, and the next snapshot replaces it. Before that, fold these files into the private repository, or the next snapshot will drop them (law 20):

- `kit/loomkit/metalsite.py`, the `metalsite` subcommand in `kit/loomkit/cli.py`;
- `kit/tests/test_metalsite.py`, `kit/profiles/zinc-site.json`;
- `kit/examples/zinc_site_fixtures.py`, `kit/examples/run_zinc_site.sh`;
- `runs/zinc-site-20261106/`, this page and its README row.
