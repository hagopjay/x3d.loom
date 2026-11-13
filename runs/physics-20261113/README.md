# physics-20261113

The first run of the physics witness (`kit/loom physics`, 13 Nov 2026) on the two PhysX records in [x3d.physics/runs/](../../x3d.physics/runs/).

| File | What it is |
|---|---|
| `evidence/physics.json` | The witness record: **pass**, grade C, coverage `{runs: 2, max_waivers: 3, require_takeover: true}`, bound to the candidate `x3d.physics` (sha256 in `subject_sha256`). Measurements list each run's references, its 3 waivers and its replay hosts |
| `controls.json` | 14 negative controls run on the real record (`x3d.physics/tools/physx_controls.py`); each is caught with its intended `PHYS_*` code |

This is **not a receipt**. A receipt needs every witness the profile `x3d-physics-physx/v1` requires; only `physics` ran. Grammar, Meaning, Traps, Page traps and Behaviour on the bridge's scenes and pages need the x3d_mcp fork checkout and a browser, and are cited from the bridge's own evidence, not repeated. Re-run to refresh: the command is in [x3d.physics/README.md](../../x3d.physics/README.md).

The candidate hash does not cover folders named `evidence` (failure mode 74), so `x3d.physics/physx-bridge/evidence/` is not bound by it. The records pin what they copied instead: the trace sha256 of each run's step hashes, and every number is read from that evidence by `tools/physx_run_record.py`.
