# Gate 0: harden the seed

Status on 2026-11-06, Mac (Apple M3, macOS 26 / Darwin 25.0), Node 24.22.2, Python 3.13 (system) and 3.12 (x3d_mcp venv).
**Measured** = run here, with the record named; **Read** = I read it, didn't run it; **Not tested** = says why.

## Verdict

**Passed with conditions.** Everything that can run on this Mac is green in three browser engines. Two items are open: one platform this Mac can't test (Windows/WSL), and the importer gaps that phase 0 documents and tests but doesn't fix. The licence blocker was cleared on 2026-11-06 (Apache-2.0; `LICENSE`, `NOTICE`). The repository is not public and nothing has been pushed.

## What passed

| Check | Result | Evidence |
|---|---|---|
| Baseline under git | `bridge/` copied unchanged from `incoming/proto/X3D-MuJoCo-Proto-Bridge`; `incoming/` untouched; first commit `4e5ca3f` | `git log` |
| Node suites (`npm test`) | **84/84 pass** (34 runtime, 14 workbench, 9 UI DOM, 19 bridge, 8 bridge UI) on Node 24.22.2 | `validation/*-results.json`; log in `../evidence/npm-test.log` |
| Importer threat tests (new, part of `npm test`) | **19/19 pass**: 16 defences hold, 3 gaps measured | `validation/importer-threat-results.json`, `THREAT-MODEL.md` |
| Build (`npm run build`) | passes. **The rebuilt `dist/index.html` was byte-identical to the delivered one** (sha256 `bc0503…f8` = `BRIDGE-DELIVERY.json` `buildSha256`) before the containerField fix; after the fix it is `51ccea…9b` | `../evidence/npm-build.log` |
| X3D 4.0 XML Schema (`npm run verify:x3d`) | **2/2 pass** (sample and packaged scene) | `validation/x3d-schema-results.json` |
| **Real-browser smoke test** (`npm run smoke`, new) | **9/9 pass**: Chromium 145, Firefox 146, WebKit 26, each with hardware WebGL 2 (ANGLE Metal on Apple M3; Firefox masks it as "Apple M1, or similar"; WebKit "Apple GPU") | `validation/browser-smoke-results.json`, `validation/browser-smoke/<browser>/` |
| └ open check 1: launch via `start.py`, X_ITE renders | the canvas holds a real WebGL context and a non-blank render (106–299 colour buckets) | `evidence.json` per browser |
| └ open check 3: run physics, drag the cyan goal | simulation reaches 2.3–2.5 s; lower link moves 0.32 m; the target drag sets joint targets [0.35, 0.60] → [0.445, 0.893], acknowledged as `x3d → target.set`, model revision unchanged | same |
| └ open check 4: drag and release the obstacle | obstacle x 0.88 → 0.734, `x3d → model.replace` accepted, revision 2, physics paused | same |
| └ open check 5: export `.x3d` and ZIP, re-import | both exports re-imported after a UI edit, and the authored obstacle restored to 1e-6 | same; exports kept per browser |
| └ open check 7: measure, pin baseline, both records | 2,500-step trial, baseline pinned, `bridge-trials.json` downloaded | `bridge-trials.summary.json` |
| └ open check 8 (part): narrow layout | at 390 px wide: no horizontal scroll; the viewport fits; Run physics works | `narrow.json`, `chromium/narrow.webp` |
| └ open check 8 (part): keyboard | Run physics is the 2nd Tab stop and toggles with Enter; focus outline visible; the shoulder slider moves with arrow keys; the obstacle number field plus "Compile authored model" works by keyboard (a non-pointer route for both drags) | `keyboard.json` |
| └ console | no errors in any browser apart from the browser's automatic `/favicon.ico` 404 | test assertion |
| Second validator: user's `x3d_mcp` fork (`fa0b389`) | **all 9 scenes pass XSD; all 9 failed semantics before the fix** (5 containerField errors each, including your `~/Downloads/Contact-Arm-Bridge.x3d`). After the scene-writer fix (`a47dc57`) the samples and every new export have **0 errors**; 2 naming warnings remain | `validation/x3d-mcp-results.before-fix.json`, `validation/x3d-mcp-results.json`, `npm run verify:x3d-mcp` |
| Licence review | Apache-2.0 is possible; no third-party blocker; X_ITE is MIT, and the CC-BY-NC in its `LICENSES/` folder covers website images that aren't shipped | `LICENSE-REVIEW.md` |
| Threat model | written; tests for what the reader rejects | `THREAT-MODEL.md` |

## Findings (things that were wrong, now or still)

1. **Fixed: X3D containerField errors in every exported scene.** `MetadataSet` under `WorldInfo` and the four `bridge.logicalId` `MetadataString`s under `Transform` were missing `containerField="metadata"`. X3DUOM 4.0's default for Metadata nodes is `value`, so they landed in a field those parents don't have. XSD and the bridge's own UOM field-name check both pass this. X_ITE renders it anyway. A strict X3D browser or converter could drop the bridge contract metadata. Fixed in `src/bridge/scene.ts`; samples regenerated. **Your downloaded `~/Downloads/Contact-Arm-Bridge.x3d` still has the old form**; re-export it from the fixed build if you share it.
2. **Open, by design choice: naming warnings.** x3d_mcp warns that `x3d-mujoco/0.1` and `bridge.logicalId` contain `.` (ClassicVRML ROUTE syntax) and `-`. They are `name` values, not DEFs, so ROUTEs are unaffected. Renaming would change the contract; leave until the 0.2 contract.
3. **Fixed 2026-11-06: notices incomplete.** `THIRD_PARTY_NOTICES.txt` omits JSZip and its dependency tree (pako, lie, …), which are inlined in the build (`LICENSE-REVIEW.md`).
4. **Open: importer gaps** T11 (a lying ZIP inflates up to about 2 GB before rejection; measured 30 MB from 34 KB), T7 (no depth limit), T5 (no field allow-list) (`THREAT-MODEL.md`).
5. **Measured, worth knowing: floating point differs across JS engines.** Regenerating the sample on Node 24.22 changed `forwardTarget`'s x from `0.778412382324806` to `0.7784123823248061` (1 ULP of `Math.cos` between V8 builds). It supports the plan's rule: bit-identical only per engine build.
6. **Smoke-test infrastructure note.** Playwright's default headless Chromium ("headless shell") has **no WebGL**: the app correctly shows its fallback message. The test uses `channel: 'chromium'` (new headless, hardware ANGLE/Metal). CI runners without a GPU need `--use-angle=swiftshader --enable-unsafe-swiftshader` (checked here: SwiftShader WebGL 2 works).
7. **Cosmetic:** the app ships no favicon (a 404 on every load).
8. **Not a determinism result:** final joint positions after the 5 s trial differ by browser (for example 0.1692 vs 0.1666 rad), but each browser's drag landed a few pixels apart, so the inputs differed (obstacle x 0.7337 / 0.7338 / 0.7375). A same-input cross-browser WASM determinism test belongs in phase 1 (replay).

## What did not pass, and why

| Item | Status | Why |
|---|---|---|
| **Licence: go public under Apache-2.0** | **Resolved 2026-11-06**: rights confirmed; `LICENSE`, `NOTICE` and generated notices added (`LICENSE-REVIEW.md`, *Resolution*). Creating the public repository waits for your go. Previously blocked | the package assigns no licence to the first-party work; only you can confirm you hold the rights to archives A and B and the generated bridge code (`LICENSE-REVIEW.md` item 1). After that: add `LICENSE` and `NOTICE`, complete the notices, then create the repository *when you say so* |
| Open check 8: Windows and WSL launchers (`START-Windows.cmd`, `START-WSL.sh`) | **Not tested** | this is a Mac; there is no Windows machine or WSL here. I read both: they only call `start.py` (`py -3`/`python` on Windows, `python3 start.py --no-browser` on WSL). Needs a Windows runner (for example a GitHub Actions `windows-latest` job once the repository exists) |
| Open check 2: orbit, zoom, switch viewpoints, click links to inspect | **Partly**: Plan view was switched and used for both drags | orbit and zoom aren't asserted (no observable contract output); link picking isn't asserted |
| Open check 6: invalid targets, field callbacks and model rebinds in the console | **Partly**: no console errors through drags, rebinds and imports | invalid-target drags (outside reach) aren't driven in the browser; the Node suite covers them with a substituted port |
| CI | **Not set up** | there is no remote repository yet (by your decision); `npm test`, `npm run verify:x3d`, `npm run verify:x3d-mcp` and `npm run smoke` are ready to become CI jobs |
| Schemas registered by `$id` | **Not done** | `$id` resolution needs a published URL; it waits for the public repository |

## How to re-run

```bash
cd bridge
export PATH=/opt/homebrew/opt/node@24/bin:$PATH   # Node 24 (keg-only install)
npm ci && npm test && npm run build
X3D_MCP_PYTHON=~/Projects/x3d/x3d_mcp/.venv/bin/python npm run verify:x3d-mcp
~/Projects/x3d/x3d_mcp/.venv/bin/python scripts/verify-x3d-schema.py
npm run smoke          # needs `npm run build` first; Playwright 1.58.2 browsers
```
