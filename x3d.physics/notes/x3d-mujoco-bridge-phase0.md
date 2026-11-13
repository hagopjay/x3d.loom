# x3d-mujoco-bridge: phase 0 + agents slice (2026-11-06)

Repo: ~/Projects/x3d/work/x3d-mujoco-bridge/bridge (git, local only, HEAD 2fb4846). incoming/ untouched.
Read first: bridge/GATE-0.md, LICENSE-REVIEW.md, THREAT-MODEL.md, AGENTS-SLICE.md.

- Node 24 is keg-only: export PATH=/opt/homebrew/opt/node@24/bin:$PATH. npm test = 84 + 19 threat checks; npm run smoke = 9/9 (Chromium needs channel 'chromium': headless shell has no WebGL).
- Fixed in bridge: Metadata containerField="metadata" (x3d_mcp semantic validator found 5 errors per scene).
- Licence: Apache-2.0 feasible; BLOCKED on user confirming rights to archives A/B + generated code; THIRD_PARTY_NOTICES misses the JSZip tree.
- MCP tools: x3d_mcp worktree ~/Projects/x3d/x3d_mcp-agents-slice, branch bridge/agents-slice (4ac4f22, no upstream, not pushed). mujoco==3.17.0 installed in x3d_mcp/.venv.
- Native MuJoCo replays browser WASM trials within 6e-16 rad.
- Headless `a hosted model -p` fails: ~/.a hosted model/settings.json sets ANTHROPIC_BASE_URL=http://localhost:8082 (proxy not running).
- Notebook gpu/mujoco_bridge_gpu.ipynb: sketch, never run on GPU.
- Follow-up spotted: x3d_mcp src/tools/convert.py (and others) parse with lxml defaults (internal entities resolve).

## 2026-11-07: Apache-2.0, guided tour, release 0.2.0
- Licensed Apache-2.0 (user confirmed rights). Tour = front door (src/tour/), lab at ?lab=1. 15/15 browser checks.
- Release: work/x3d-mujoco-bridge/release/X3D-MuJoCo-Bridge-0.2.0.zip (deploy, 14.2 MB) + -source.zip + SHA256SUMS.txt; built by bridge/scripts/package-release.py; DEPLOY.md inside.
- Playwright Firefox quirk: contexts without `locale` have navigator.language undefined -> X_ITE throws "invalid language tag". Set locale.
