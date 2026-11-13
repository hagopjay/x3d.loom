# Slice 1: agents (PLAN.md section 8, items 5 and 6)

Status 2026-11-06. **Measured** = run here; **Sketch** = written and checked, not run.

## MCP tools in the x3d_mcp fork

Local branch `bridge/agents-slice` (commit `4ac4f22`, based on `origin/main` `8dd0d3e`), checked out as a separate worktree at `~/Projects/x3d/x3d_mcp-agents-slice`, so your main checkout (on `fix/physics-findings`) is untouched. The branch has **no upstream and has not been pushed**.

| Tool | What it does |
|---|---|
| `validate_scene` | X3D XSD + semantic checks; plus the bridge contract `x3d-mujoco/0.1`: contact-arm/1 annotations compiled in MuJoCo, package consistency (manifest = X3D = MJCF), snapshot losses |
| `mjcf_to_x3d` | any MJCF → X3D 4.0 posed snapshot (profile `mjcf-snapshot/0`): sphere, box, cylinder, capsule, ellipsoid, plane, inline mesh; Z-up → Y-up; masses, joints and logical ids as Metadata; a machine-readable **loss report** |
| `simulate` | MJCF, a bridge scene or an experiment package on native MuJoCo 3.17; trial record in the browser's `trial-v1` shape (same columns); for contact-arm it reproduces the browser's *Measure 5 s* by default; `package_out` writes an importable package |

Code: `src/mujoco_bridge/` (contract, safety, scene_io, snapshot, sim) and `src/tools/bridge_tools.py`. Optional dependency: `pip install -e '.[bridge]'` (`mujoco==3.17.0`, pinned to the browser's WASM build).

### Evidence (Measured)

- **Tests**: `tests/test_bridge_tools.py`, 31 pass. The full x3d_mcp suite: 506 pass, 7 skipped, and 1 failure that was already there (`test_playground_app.py::test_run_input_checks`, which fails the same way on your unchanged checkout).
- **The same contract in two languages**: Python's `compile_recipe` is byte-identical to the browser's MJCF for the sample package and for a package WebKit exported after a real mouse drag.
- **Native = WASM to a few ULP**: replaying the three browser trials (Chromium, Firefox, WebKit; 2,500 contact steps each) on native MuJoCo gives final joint angles within **2–6 × 10⁻¹⁶ rad**, with every telemetry column matching (test tolerance 1e-12 for qpos, 1e-9 per column).
- **Driven over stdio**: `validation/agents-slice/drive.py` launched the real server as an MCP client and called all three tools; requests and responses are in `calls.json`. The server listed 38 tools, the 3 new ones among them. The pendulum converted with 0 XSD and 0 semantic errors and a 3-item loss list; the arm trial wrote `agent-trial.zip`, which `validate_scene` found consistent; a hostile `<include>` was refused.
- **Round trip into the browser**: the browser bridge imported `agent-trial.zip` (written by Python) and a GPU-notebook variant package, with no console errors.
- **Visual check**: `pendulum-xite.webp` is the snapshot rendered in X_ITE 16.7. The links point the way keyframe `tilted` (1.2, −0.6 rad about y) predicts, which confirms the Z-up → Y-up mapping in a real renderer.

### Why not a headless `a hosted model -p` session

I tried: `a hosted model -p` with a temporary `--mcp-config` (`--strict-mcp-config`, nothing written to your settings). The server **connected** (`x3d-bridge: connected`). The model call failed with `ConnectionRefused`, because `~/.a hosted model/settings.json` points the CLI at `ANTHROPIC_BASE_URL=http://localhost:8082` (a local proxy with GPT model aliases), and nothing was listening there. I did not change your settings or use other credentials. So this a hosted model session drove the server through the MCP stdio client instead (above). To use the tools from any a coding agent session once you want them:

```bash
a hosted model mcp add x3d-bridge -- ~/Projects/x3d/x3d_mcp/.venv/bin/python ~/Projects/x3d/x3d_mcp-agents-slice/src/server.py
```

## Colab GPU notebook (Sketch)

`gpu/build_notebook.py` → `gpu/mujoco_bridge_gpu.ipynb` (10 cells, self-contained: it embeds `gpu/rollouts.py`, the fork's `mujoco_bridge` package and the sample package). It follows the jepa-bridge pattern: a GPU check, a form (`PROFILE` smoke 8 / core 1,152 / full 9,600 worlds, `BACKEND` mjx|warp, `PACKAGE_PATH`, `TOP_K`), Drive mount (`My Drive/x3d.io/mujoco-bridge-runs/<run>-<profile>/`), an install pinned to MuJoCo 3.17.0 + MJX, and a **doctor** cell (GPU visible, versions, package reads, one MJX world against native MuJoCo on the package's own trial, measured throughput and an ETA). Then the sweep, then the packages written out: `results.zip` (the input's core members + `records/gpu-batch.json`) and `variant-NN.zip` for the top variants by peak touch force, each importable and replayable in the browser.

Checked on the Mac: the notebook builds; every code cell parses; sweeps, results packages and variant packages work (they pass the Python consistency checks, and the browser imports a variant). **Not run**: everything that needs JAX or a GPU. Expected first-run fixes, which the doctor is there to catch: MJX's contact-count field (`d.contact` vs `d._impl.contact`), whether MJX 3.17 accepts `implicitfast` for this model, float32 drift against the CPU reference (the threshold is 5e-3 rad, an Estimate), and the MuJoCo Warp backend, which is a `NotImplementedError` placeholder until its API is confirmed on the G4.
