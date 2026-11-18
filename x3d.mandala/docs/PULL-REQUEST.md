# Add native X3D Sri Yantra Resonance Loom with measured geometry and shared audio time

The supplied mandala scaffold describes attractive radial shader imagery but has no concurrent Sri Yantra construction, independent chamber witness or implemented shared audio transport. This change adds a separate `x3d.mandala/` instrument: native X3D geometry and optional Web Audio around a fixed, measured concentric Sri Yantra.

Nine canonical triangles produce 43 odd-coverage triangular chambers in rings 1 / 8 / 10 / 10 / 14. A standard-library Decimal builder selects a stated Huet/Chiodo-family member, while an independent finite-segment arrangement retains all 74 bounded cells, including 31 even-coverage voids. Certificates distinguish binary64's 10⁻¹² R constraint bound from binary32/native-field's 10⁻⁷ R bound; the recorded binary32 concurrency residual is about 1.84×10⁻⁸ R. No unique historical shape or high-precision pixel claim is made.

The scene uses X3D coordinates, ribbons, chamber fills, lotus rings, points, materials, switches and whole-layer similarity transforms. Canonical vertices stay fixed. A synthetic circular-phase field modulates the authored appearance, while a shared transport preserves phase across tempo changes and audio/display clock handover. Sound starts only after a user gesture. Stillness, pause, mute, backgrounding and disposal have separate behavior.

The source change includes a local Python server, standalone builder, field guide, attachment review, math data, controls and fold-back lessons. Generated `dist/` files are excluded from the patch; the downloadable release ZIP also includes prebuilt standalone HTML and an initial X3D scene. X_ITE 16.8.0 is pinned with a hash inventory; the standalone build records its bounded resource-URL adapter. Snapshot, score/settings and certificate exports state their different scopes. The root README links the new app and reusable learnings.

## Review and validation

The exact executed results, environments and remaining browser/audio/display limits are recorded in [VALIDATION.md](VALIDATION.md). Review that record before treating any command below as evidence of success on your host.

From `x3d.mandala/`:

```bash
node --test test/*.test.mjs
python3 -m unittest discover -s test -p 'test_*.py'
python3 tools/audit_independent.py --self-test
node tools/build.mjs
python3 serve.py --open
```

Controls cover source and serialized geometry, binary32 quantization, a symmetric near-fake, topology recovery, circular coherence, geometry-preserving animation, and explicit audio-clock/scheduler adapters. Adapter tests do not establish native rendering or audible output. This application does not claim repository-wide Loom certification, medical effects, a live network, or a portable X3D audio checkpoint.

## Integration target and publication state

- Base: `a02a1a289b222900382e5106132d79f80a35dc28`
- Proposed branch: `feat/resonance-yantra`
- Changes: new `x3d.mandala/`, root `LEARNINGS-sri-yantra.md`, and a root README link.
- Publication is blocked in this workspace: the GitHub connector is disabled by the administrator and `gh` has no authenticated account. No remote PR has been opened. The delivered patch and this description are ready for review and publication from an authorized checkout.

See [APPLY-PATCH.md](APPLY-PATCH.md) for the exact-base workflow.
