# What the Math Lab launch teaches (17 Nov 2026)

Source: the `x3d.mathlab` distribution (six lessons: linear maps, derivative, integral, Fourier, Lorenz, gradient descent), put live in https://github.com/hagopjay/x3d.mathslab at commit 78c3aa4 / c. 17 Nov 05:05 UTC. Grades follow the Loom convention: **C** = a named tool ran, **L** = read or reasoned, **S** = suspected. Records: `receipts/` and `docs/PAGES.md` in that repository. Environment for every number: Linux x86_64, CPython 3.13.18 (native), Pyodide 0.27.7 = CPython 3.12.7 (WebAssembly), Chromium via Playwright 1.63.0 (software GL), mcp 2.3.0, SciPy 1.17.0, Node 22.23.4.

## 1. Five findings

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 1 | A fold-back's validation was true for one **major version** of a dependency and silently false for the next. The delivered receipts named mcp 1.29.0; the first fresh run under mcp 2.3.0 failed 4 of 89 tests (`mcp.server.fastmcp` renamed `MCPServer`; model attributes `readOnlyHint` became `read_only_hint`). After a 4-line shim, 93 of 93 pass and the stdio probe passes 6 of 6. | C | `python -m unittest discover` (89 then 93 tests), `tools/probe_math_mcp.py` | A receipt must name every dependency major version; a fresh-environment run is a witness, a copied receipt is not. |
| 2 | **A float hash is a same-runtime identity.** Same source files, default parameters, native CPython vs Pyodide: integral, Lorenz, gradient are bit-identical (0 of 12,320 floats differ); linear, derivative, Fourier differ in 18, 5 and 20 floats by at most 4.441e-16 absolute (about one ulp). Those three use `sin`/`cos`/`exp`; the identical three use only +, *, sqrt. Source hashes match everywhere. | C | `receipts/runtime-parity.json` (floats walked recursively over the whole sample) | Identity hashes of numeric data bind to a runtime; across runtimes compare with a stated tolerance, never by hash. |
| 3 | **A scene can pass every structural check and still be partly hidden.** The 3D canvas filled the stage and an equation card overlaid its bottom ~100 px: node counts and X3D validation were green while the Lorenz, gradient and integral scenes were partly behind the card at 1440x900. Sizing the canvas to the unobstructed region and zooming the authored viewpoint (field of view x0.75, view-only) fixed it. | C | before/after screenshots, Playwright 1.63.0 | Add a screenshot witness for overlays; a node count is not a visibility check. |
| 4 | **One model owner survives a move to static hosting.** The kernels are pure standard library, so Pyodide ran the unmodified files behind the same request gate and 4 MiB budget: six of six lessons rendered, 0 console errors, first scene 4.6 to 5.0 s including a ~10 MB runtime download, each lesson switch 2.1 to 2.5 s (includes a 1.5 s settle wait in the probe). No JavaScript re-implementation, so nothing to drift. | C | `receipts/browser-smoke-pages.json` vs `receipts/browser-smoke-server.json` | Prefer running the owner's code in the page over porting it; list "stdlib only" as a portability contract and test it (`tests/test_pages.py`). |
| 5 | **Where a renderer executes code, the public page must not host it.** Manim rendering runs Python. The Pages build generates Manim *source text* from the shared sample and never imports Manim; there is no code-execution endpoint. | L | design plus a test that the browser module list excludes `mcp_server` and never imports `manim` | Split "generate" from "execute"; only generation may ship to a public static host. |

## 2. Reusable pieces

* `tools/browser_smoke.js` (in x3d.mathslab): one headless pass over every lesson, a parameter nudge that must change the model identity, a download check, console-error capture, JSON receipt. Works against both transports.
* Transport selector: a page asks the loopback server's `/api/health`; any other host uses the in-browser runtime. Same response shape either way, so the controller code is unchanged.

## 3. What this does not prove

* No hardware GPU, no Firefox or Safari, no phone; Chromium software GL only.
* Parity was measured at default parameters, not across the full parameter space.
* The Manim video path was not run (needs a local Manim install); only its source generation was.
* Pages itself becomes live only when the repository owner enables it (Settings, Pages, main, root); this note describes the files, not a deployment state.
