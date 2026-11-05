# Review: Scientific Loom Observatory, pass 1 (4 Nov 2026)

The first x3d.STEM delivery. Source: `~/Downloads/Scientific-Loom-Observatory-Pass1.zip` (283,813,037 bytes, sha256 `163e7e60…0b0e7`, 318 files), unpacked read-only into `../incoming3/` (`READY.txt`). Running copy: `projects/scientific-loom/`, served at :8822 and on the demo index. Grades as in LOOM-v1.md: C = a tool ran here; L = read in the source or reasoned; S = suspected or a judgment.

The same download folder held a loose `TECHNICAL.md`. It is byte-identical to Gear-Loom's TECHNICAL.md (C, `cmp`), a stray, not part of this delivery.

## 1. What it is

An offline X3D/X_ITE observatory with its own numerical case bank, aimed at "polished ParaView output" as the visual standard [README; DEBRIEF]:

| Study | Model | Bank | Witnesses declared |
|---|---|---|---|
| Quantum Vortex Theatre | Gross–Pitaevskii, i ψₜ = −½∇²ψ + (\|ψ\|²−1)ψ, periodic cube L = 24, Strang split-step Fourier | 2 runs × 80³ × 49 states (coaxial, offset rings) | particle number, Hamiltonian, phase-winding integers, reversibility, temporal refinement (ratio ≈ 0.25, second order), display clipping |
| Kerr Observatory | Null geodesics in Kerr, u = 1/r and z = cos θ, RK4 step doubling | 3 observer cases × 1,600 × 1,000 rays (Schwarzschild; a = 0.94 at 68°; near edge-on) | 0 unresolved rays, separated null constraint (< 7×10⁻⁹), Schwarzschild capture b² = 27, refined rays, clipping |
| Matter, Self-Assembled | Cahn–Hilliard cₜ = ∇²(c³ − c − κ∇²c), stabilised semi-implicit; one-way finite-volume conduction | 2 runs × 72³ × 41 states (droplets, bicontinuous); 36³ conduction | mean composition, free-energy monotone, conduction residual (< 10⁻⁸), uniform-medium reference, clipping |
| Phononic Instrument | 3D vector elasticity, Q1 hexahedra, complex Bloch condensation (5,184 DOFs) | 2 materials × 16 branches × 21 k-points on Γ–X–M–R–Γ; 3 display modes each | Hermitian stiffness, generalized residual, **mass orthogonality**, non-negative ω², Γ rigid-body, homogeneous long-wave P/S reference |

Also included: 24 ParaView exports (VTI fields, VTU modes) straight from solver checkpoints, with provenance; 18 evidence files (accepted and rejected); `docs/GATES.md` (18 proposed science gates, 3 open); `docs/CLOUD.md` (L4/G4 honesty notes); a rebuild recipe into fresh candidates (`--profile high` raises grids, untested).

## 2. Measured here (C)

| Check | Result |
|---|---|
| Archive integrity | `unzip -t` passes (applying yesterday's rule R26 first) |
| Shipped offline gates, pinned interpreter (`_venvs/loomsong-build`: Python 3.12.8, numpy 2.3.5, scipy 1.17.0, Pillow 12.3.0, lxml) | `tools/audit.py` 9 of 9 cases pass, **regenerated audit.json byte-identical to the shipped one**; `tests/negative_controls.py` 6 of 6 caught; `tests/deformation.py` pass |
| Builder binding | All four `builder_sha256` values equal the shipped `tools/{vortex,kerr,matter,phononic}.py`; Kerr's appearance builder matches too |
| Browser (headless Chromium, software GL) | All four studies render; screenshots in `projects/_screens/sci-*.jpg`. Console: favicon 404 and 9 X_ITE warnings that `ComposedShader`/`ShaderPart` do not match the component/profile statements of `field.x3d` and `kerr.x3d` |
| Loom Grammar (fork fa0b389) | XSD 4.0: both scenes valid |
| Loom Meaning (fork fa0b389) | **3 errors per scene**: ComposedShader and ShaderPart (Shaders level 1) and TextureProperties (Texturing **level 2**) not declared for profile Immersive. X_ITE warned about the first two only: it checks component names, not levels (the 30 Oct finding, confirmed again) |
| Loom Traps | 0 hits on 11 rules |
| loomkit `sci` (reconstructed SCI gates) on the real bank | Pass, normal and `-O`: 9 cases, 4 kinds, 196 frames hashed **and opened** |

## 3. Findings

**F1. The admission gate is an `assert` (C).** `tools/audit.py` ends with `assert all(...)`. In a scratch copy with one corrupted payload, the audit exits 1 normally and **0 under `python -O`**; its JSON still says `all_pass: false`. Six gate files use the pattern (`audit.py`, `negative_controls.py`, `deformation.py`, `report.py`, plus `surface_geometry.py` and `export_readback.py`, which need VTK), and `tools/common.py` guards encoded input the same way. It is Loomsong's A02 again, in a new project from the same model. `release.py` reads the JSON (`SystemExit` if not green), so packaging is safe, but anything that trusts the exit code, including `tools/rebuild.py`'s `check=True` chain under `PYTHONOPTIMIZE`, is not.

**F2. Hashing is not opening (C).** A PNG truncated so it has no IEND chunk, with its bytes and sha256 re-recorded to match, passes the shipped audit (exit 0, `all_pass: true`). That is exactly their own process finding ("PNG payloads shorter than recorded… no final IEND chunk") and yesterday's Living Archive zip. loomkit `sci` rejects it (`SCI_PUBLICATION_UNDECODABLE`).

**F3. Evidence is not bound to the candidate (C, by inspection of all 18 evidence files).** `browser.json`, `transitions.json`, the reconstruction and surface files carry no candidate or subject digest; `release.py` admits on `browser.json`'s `all_pass` alone. A browser pass on old shaders would license new ones: Loomsong's A01, fixed in v2, absent here.

**F4. Profile/component declarations (C).** See Meaning above. Fixed in the generator (`tools/scene.py`), not the scene files (law 1).

**F5. The governance patch is missing (C).** `evidence/patch.json` records a 4-file, 8-test additive patch (sha256 `5e0aac32…f725`) that "is supplied separately"; it is not in the zip, Downloads or Drive. The user may upload it; until then `kit/loomkit/sci.py` reconstructs its gates from GATES.md, labelled L.

**F6. The science is strong, and honest about its limits (L, reading the manifests and debrief).** Every case names its equation, units, boundary, parameters and at least one stated limitation; reference controls exist for three of four kinds (Schwarzschild capture, uniform conductor, homogeneous continuum); open questions (topology convergence, full-Brillouin-zone gap, paired ParaView review) are listed as open, not passed.

**Visual flags (S, located concerns from screenshots, no grade).** Kerr: no thin photon ring at the shadow edge; the debrief already states single-ray pixels cannot resolve critical-curve structure. Matter (bicontinuous, t = 120): scattered white specular hot spots on the brass interface, possibly highlight aliasing in the ray marcher. Phononic: voxel tops clip to pure white under the key light.

## 4. What the hardening patch does

`proposals/scientific-loom-hardening.patch` (85 lines, 7 files, sha256 `04da081d…`):
- `tools/scene.py` declares `<component name="Shaders" level="1"/><component name="Texturing" level="2"/>`; both scenes regenerated by it (the patched files equal the generator's output, C).
- `tools/audit.py` also fails a PNG without IEND and exits through `SystemExit`, not `assert`; `tests/negative_controls.py`, `tests/deformation.py` and `tools/report.py` likewise.
- **Not covered:** `tests/surface_geometry.py` and `tests/export_readback.py` (they need VTK, which is not installed here, so a change could not be tested) and the input guard in `tools/common.py` (`assert a.shape… and np.isfinite(a).all()` before encoding: under `-O`, non-finite fields would be encoded silently). Same fix pattern; left for a run where VTK is available.

Verified on a clean copy (C): applies cleanly; the project's own audit, negative controls and deformation still pass; the audit now rejects the corrupted payload and the rehashed truncated PNG **in both normal and `-O`**; Loom Meaning passes; the project is **accepted under `x3d-stem-science/v1`** (`runs/scientific-loom-20261104-hardened/receipt.json`). The original as delivered is rejected (`WITNESS_NOT_PASS: meaning`, `runs/scientific-loom-20261104/`). Candidate binding for browser evidence (F3) is not in the patch: it needs the browser test harness changed and rerun.

## 5. What the other model learned (from the debrief; L, as reported), as Loom rules

| # | Lesson | Source |
|---|---|---|
| S1 | **Conservation is not intention.** Reversed ring circulation conserved every invariant while turning approach into separation; measured low-density positions exposed it. A witness must test the promised event, not only properties every valid solution shares | DEBRIEF "useful failures"; GATES.md |
| S2 | **An eigenvalue is not an eigenspace certificate.** A sparse solver returned good eigenvalues and residuals but non-orthogonal degenerate modes; mass whitening + Hermitian Rayleigh–Ritz repaired the subspace. Applies to modal animation, PCA, spectral clustering, reduced-order models | DEBRIEF §04 |
| S3 | **Display precision belongs in the scientific budget.** 8-bit encoding moved the early zero-isosurface; concentration went to 16 bits (bound 1.91×10⁻⁵). More pixels cannot restore discarded information | DEBRIEF §03 |
| S4 | **A successful solve is not a successful release.** Truncated PNGs; atomic publication, fresh candidate directories and post-write byte/decode checks | DEBRIEF; process-findings.json |
| S5 | **Independence needs a different source of assumptions, not a different language.** The shader and the CPU probe agreed while both used L/(N−1) instead of L/N spacing; a second Y flip turned an empty atlas tile into a false surface | GATES.md failures |
| S6 | **Pick the coordinate that conditions the problem.** Integrating from r = 200 accumulated constraint error; u = 1/r makes the radial potential polynomial. Small local step errors were not enough; the conserved-constraint witness and analytic capture control rejected the first version | DEBRIEF §02 |
| S7 | **A surface is not the object.** A density isosurface surrounds a vortex core; it is not the nodal line. Winding plaquettes can vanish while density dips remain: no reconnection claim from a picture | DEBRIEF §01 |
| S8 | **Fixed transfer ranges, counted clipping.** Clipped samples were fixed by enlarging declared ranges and rebuilding, never by relabelling | GATES.md |
| S9 | **Scientific time ≠ display time.** Playback commits saved states; it never synthesises intermediates. Case switches commit only verified payloads (generation tokens, latest request wins) | DEBRIEF "engineering object" |
| S10 | **Compute where the evidence shows the bottleneck.** Coordinates and precision were repaired before adding rendering expense | DEBRIEF closing |
| S11 | **Cloud hosting does not move rendering.** A GPU workstation session does; solvers are CPU and need their own equivalence witness before any GPU port | CLOUD.md |
| S12 | **Promotion needs six things:** triggering failure, minimal reproducer, independent observation, explicit policy, a counterexample the rule does not cover, and a broken candidate it rejects. Local thresholds stay local | GATES.md "Promotion rule" |

And one from this review: **S13. A project that writes its own gate code from scratch can lose the Loom's hardest-won rules.** F1 and F3 were solved in Loomsong v2 (2 Nov) and regressed here. Shared acceptance code (loomkit, or the family's own) reused across projects prevents that better than re-explaining the rule in each kickoff.

## 6. Not done here

- Browser tests (`tests/browser.cjs`, `transitions.cjs`, `reconstruction.cjs`, `inspect.cjs`) need Playwright installed in the project; the 51 browser checks were not rerun.
- `tests/surface_geometry.py` and `tests/export_readback.py` need VTK 9.3.1 (not installed; no download).
- No ParaView comparison, GPU measurement or expert review: all open in the source too.
- The rebuild (`tools/rebuild.py`) was not run; the reference build takes CPU hours by its own account (L).
