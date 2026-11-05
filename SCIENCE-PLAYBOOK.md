# Science and maths playbook (Loom v1.0)

How to build a science- or maths-intensive X3D study under the Loom, distilled from six x3d.STEM flagships (4–5 Nov 2026). Each pattern names where it already runs, so a new study copies working code instead of re-deriving it.

- **Paths:** `x3d.STEM/…` paths are relative to `~/Projects/x3d/x3d.STEM`; `kit/…` and `runs/…` are relative to this repository.
- **The rules behind these patterns:** [LOOM-v1.md](LOOM-v1.md), laws 17–35 and failure modes 58–92.
- **Start every study with:** the card in [kit/templates/SCIENCE-STUDY-CARD.md](kit/templates/SCIENCE-STUDY-CARD.md).

## 1. The order of work

1. **Card first.** Write the model, its stated limits, the exact references available, and the claims the captions will make.
2. **Explore the instrument, including the worst case.** Run the solver on easy cases *and* on the hardest one you can name:
   - the cusp (s-states);
   - the curved domain (a ventricle);
   - the dark or symmetric view;
   - the chaotic case.

   Record the numbers.
3. **Declare limits in the builder's docstring before the first build,** with the exploration numbers beside them (every x3d.STEM builder does this).
4. **Build; keep every red run** in `evidence/history/` with the reason.
5. **When a red or a surprise appears, suspect the witness first** (law 26). Then change one variable at a time (law 29).
6. **Fix the instrument, not the threshold** (law 28). A correction you fitted is grade L. A quantity that depends on the analyst's choices is reported, not gated.
7. **Browser evidence, then Loom acceptance:** `kit/examples/run_x3d_stem.sh <study>`, then a receipt.

## 2. Witness patterns

### A. Exact references: use them even when the problem is "solved"

| Pattern | Example (where) | Typical result |
|---|---|---|
| Closed-form solution of the model | Hydrogen −1/(2n²), ⟨r⟩, Laguerre radial functions (x3d.STEM `studies/electron-cloud/tools/radial.py`) | 2.5e-5 raw, 5e-9 after Richardson |
| Exact travelling wave | Nagumo front speed √(kD/2)(1 − 2a) with recovery switched off (`studies/living-heart/tools/ap.py`) | order 2.05, Richardson 1.4e-4 |
| Exact dispersion relation | Bogoliubov ω = k√(1 + k²/4) (`studies/vortex-sound/tools/vortex.py`) | 4e-6 to 1.1e-4, order 2.0006 |
| Analytic secular law | Peters a(t) and a(e), Newtonian chirp Ω ∝ τ^(−3/8) (`studies/chirp/tools/inspiral.py`) | 1e-4 to 3e-4 |
| Analytic geometry | Bardeen critical curve, e^−π sub-ring ratio (`studies/kerr2/tools/kerr2.py`); 90 % radius of 1s (2.6612 bohr) | 2e-4; 0.25 % |
| **Exact discrete identity** (stronger than the continuum) | A small Fourier or Neumann mode decays by exactly (1 + dt λ_discrete)ⁿ (Turing Garden, Living Heart); Σ(u + v) changes by exactly dt Σ(reaction); the masked Laplacian sums to zero (no-flux walls); a unitary step conserves the norm | 1e-10, 1e-14, 7e-19, 1e-14 |

An exact discrete identity checks the code, not the continuum model. Pair it with an observed order of convergence, which checks the continuum limit.

### B. Convergence

- **Observed order** p = log₂(e(2h)/e(h)) against the method's order (forward Euler 1, three-point differences 2, Strang 2). The observed order is itself a witness: |p − expected| ≤ 0.05 to 0.1.
- **Richardson extrapolation** to compare with an exact value tighter than the raw grid allows.
- **Refinement for statistics** where no exact value exists: spiral period (h vs h/2: 0.93 %), ring speed (0.38 %).
- **A finer check grid** for quantities the display grid cannot resolve. 3D normalization on a 160³ grid, while the 80³ display grid's sum is reported (Electron Cloud, failure mode 76).

### C. Invariants admit; events confirm (law 21)

Conservation (norm, energy budget, maximum principle) rules a run *in*. A separate witness must test the claimed event:

- **Topology:** the loop sequence on two grids, with event times within a declared tolerance (vortex reconnection).
- **Morphology:** pieces, holes, Euler characteristic, mean curvature, late activity (Turing Garden names).
- **Dynamics:** for example "steady" means the spread of the last periods is small.

### D. Measured claims

Every word in a caption that names a regime or event is a measured claim with a declared threshold: "spots", "coral", "restless", "reconnection", "Lyman-α at 121.5 nm". Names from another dimension or geometry are not evidence (law 30).

### E. Controls that must fail (law 19)

- **Negative controls:** a flipped capture (orientation), a 2 % resampled audio track (pitch), reversed faces (mesh volume), mutated manifests (science gates).
- **Signal floors:** a dark or flat frame correlates with anything (Kerr 2).
- **Symmetric views** defeat orientation controls: choose evidence views that make the control bite.

### F. The display chain is part of the science (law 23)

- **Quantization:** state the encoding and *measure* its effect in the study's own units. For example: isosurface shift in cells (p99, worst frame), or how far a surface moves.
- **Precision chosen to meet the witness:** 8-bit unless the declared limit fails, then 16-bit for that case alone (Turing Garden chaos).
- **Clipping counted, never hidden.** Transfer ranges fixed and declared.
- **Interpolation between published samples:** the error is bounded and stated (Chirp, 1.3e-3).
- **Meshes:** closed (zero boundary edges); volume against an independent estimate (gross-error check); vertices on the requested surface (Newton projection with the exact trilinear gradient, not central differences: failure mode 70).

### G. Cross-implementation witnesses (law 25)

- **The browser recomputes from the verified payload** and must match the builder: mesh vertex and triangle counts exactly, volume to 1e-6; wave heights to 1e-6; excited-cell counts exactly.
- **An offline renderer reproduces the browser frame** (Kerr 2): correlation, mean difference, signal floor, flipped control, with the capture bound to the page sources.
- **Shared code is a shared assumption.** The browser mesher is one file (`lib/stemkit/js/nets.js`), and a test keeps the study copies identical. A port is independent only of the *language*, not of the algorithm.

### H. Reproducibility

- Parallel kernels with no reductions (numba `prange` over cells) give bitwise-reproducible runs. A prefix is rerun bit for bit as a witness.
- Seeds, seed centres, grids and timesteps are recorded in the manifest.
- Builder and solver files are bound by hash (`SCI_STALE_DEPENDENCY`).

### I. Units

- **Nominal conversions** (12.9 ms per Aliev–Panfilov unit; healing lengths; bohr) are stated as nominal.
- **A unit-conversion witness** (Lyman-α wavelength from E₂ − E₁) is labelled a units check. Its error equals the energy's.

## 3. Numerics cheat-sheet

| Method | Expected order | Exact control used | Stability / trap |
|---|---|---|---|
| Forward Euler reaction–diffusion | 1 in dt | Discrete linear mode; budget identity | dt ≤ h²/(2 d D); the noise must respect the bounds the max-principle witness checks |
| Three-point eigenproblem (radial Schrödinger) | 2 in h | Energies, Laguerre forms, virial theorem | The cusp at r = 0 limits 3D quadrature, not the 1D solve |
| Strang split-step (GP) | 2 in dt | Unitary norm; Bogoliubov | Initial states must be periodic and relaxed; the periodic box changes ring speeds |
| DOP853 ODE (inspiral) | tolerance | Energy budget via integrated work; Peters | Stop where the model stops (r = 6 M) |
| RK4 step doubling (Kerr rays) | 4 | Bardeen curve; constraint | Keep passive variables (φ near a pole) out of the error norm (failure mode 63) |
| Surface nets | Second-order surface (inscribed) | Sphere, torus (Euler characteristic 2 and 0), step | Project with the exact trilinear gradient; pad below iso to close surfaces |

## 4. Builder and page skeleton

### The builder

`x3d.STEM/lib/stemkit`:
- `Study.publish_deflate` and `publish_png` reopen what they write.
- `save_case` writes `loom.scientific-case/1`, with frames, witnesses, metrics, limits, and `dependencies` hashes.
- `docs --numbers` generates the witness tables, so prose never retypes a number.

### The page

Every x3d.STEM study's `src/app.js` follows the same shape:

1. **Verify every payload before use:** sha256 of the compressed and of the decoded bytes.
2. **Load the world with `loadWorld()`,** which has a time budget.
3. **Wire navigation only after the scene loads,** and route again if the hash changed meanwhile.
4. **Drive playback through X3D:** `TimeSensor → IntegerSequencer → Switch`, never blending frames. Start it with `getCurrentTime()`.
5. **Guard every field callback with try/catch.**
6. **Report what the page drew** through a read-only view function (`kerr2View()`, `gardenView()`, …), and support deep links that set a whole view.
7. **Keep the ledger honest:** red rows stay red, and the browser's own checks appear as rows.
8. **Make viewpoint switches instant** (TELEPORT) before capturing.

### Evidence

`tools/record_browser.py` binds a browser run to the hashes of the page sources and case manifests. It includes:
- the cross-check;
- playback;
- a navigation-during-load probe;
- a **resilience probe**: the callback's own function throws once, and playback must keep advancing.

`tools/check_browser.py` refuses stale or incomplete evidence.

### Acceptance

`run_x3d_stem.sh` runs Grammar and Meaning (fork), Traps (scenes), **Page traps** (page code: callbacks, clock, navigation, globals, load budget, syntax), Science (manifests), Behaviour or Eyes (browser evidence), then a receipt and a stale-witness control.

## 5. Where the paid-for traps are indexed

[LOOM-v1.md §8](LOOM-v1.md):
- **Science and maths:** 59, 62, 63, 65–71, 76, 79, 82, 85–87.
- **Browser and X_ITE:** 60, 61, 64, 72, 73, 77, 78, 80, 84, 88, 89, 92.
- **Evidence handling:** 74, 75, 81, 83, 90, 91.
