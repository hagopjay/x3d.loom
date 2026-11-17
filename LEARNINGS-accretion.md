# What Accretion teaches (17 Nov 2026)

Source: https://github.com/hagopjay/x3d.accrete at commit 93063bf (reference implementation supplied as a ZIP + patch, then reviewed, fixed and given a static viewer). Grades: **C** = a named tool ran, **L** = read or reasoned, **S** = suspected. Environment for every number: Linux x86_64, CPython 3.13.18, lxml 6.1.3 (libxml2 2.14.6), jsonschema 4.26.0, Node 22.23.4, Chromium 153.0.8010.12 (Playwright, software GL), vendored x3d_mcp pinned at b5c9956 (XSD 4.0 + semantic with 4.1 UOM), bundled X_ITE 16.6.0. No model or paid API calls were made.

Accretion is the Loom's witness/gate/receipt split in miniature: a **planner** (deterministic, seeded by the previous hash) places, an untrusted **generator** proposes, a **gate** (restricted whitelist + pinned validator) admits, a hash-chained SQLite **ledger** records. The generator is "S", the gate is "C", the ledger is the receipt.

## 1. Findings

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 1 | **The gate's vocabulary and the validator's vocabulary can disagree, and nothing notices.** `PhysicalMaterial` is documented as admitted, but the pinned semantic pass reports `profile-component` under the Immersive wrapper, so it can never be admitted. | C | review lane ADAPTER, reproduced by 2 verifiers | One full-pipeline test per admitted node type. |
| 2 | **The XSD is not a magnitude check.** `Box size="1e-320 ..."` and `Transform scale="1e-40 1 1"` passed the fragment gate, the pinned XSD and the pinned semantic pass (a single-precision parser reads 0 or a denormal); `Sphere radius="1e-60"` was caught only because that field has a `minExclusive` facet. Fix: floor sizes and scales at the smallest normal float32 (1.1754944e-38). | C | `tests/test_review_fixes.py` | A Python double is not an SFFloat; range-check at the field's real precision. |
| 3 | **Lexers drift.** Python `\d` and `str.split()` accepted Arabic-Indic digits and NBSP as number syntax; the canonical output re-serialised to ASCII so the output was clean but the *hashed raw bytes* were a non-X3D lexical form. | C | same | Parse numeric fields with an ASCII-only lexer; hash what you parse. |
| 4 | **A "read-only viewer" on loopback is still readable by any web page.** No Host check meant DNS rebinding could read the whole ledger by GET. A Host allow-list, a socket timeout, `frame-ancestors`, HEAD and key-permission repair were added with tests. | C | 7 tests in `tests/test_review_fixes.py` | Local servers validate Host on every method, not just Origin on POST. |
| 5 | **Port the verifier, then prove parity.** `web/verify-archive.js` re-computes the chain in the browser (Web Crypto SHA-256, a port of `accretion-c14n/1` including Python float `repr` rules, placement replay). It gives the same verdict and the same error text as the Python verifier on a valid archive and 7 tamper cases. Where JS cannot match (no gate, no lxml), it says so in the result's `scope`. | C | `tests/test_static_export.py` | A second implementation of a verifier is only trusted with a differential test and a stated scope. |
| 6 | **Self-consistency is not authorship.** A forger who recomputes hashes and the checkpoint header passes `verify_archive`; truncation passes without a trusted checkpoint. Hosting the archive on Pages adds no trust; the published checkpoint comes from the same origin. | L (read + reasoned, reviewer reproduced one case) | `docs/REVIEW-2026-11-17.md` L1 | Keep a checkpoint out of band; re-run the gate on `raw_x3d` in verification (proposed, not built). |
| 7 | **Evidence bytes that are not reproducible are one-off facts.** The benchmark's byte sizes and checkpoint hashes cannot be recreated because entry seeds come from timestamps; only timings reproduce (about 5%). | C | review lane CLAIMS | Label single-run values; give benchmarks a fixed seed. |
| 8 | **The claimed bottleneck was right, and the fix is known.** At ~100 entries append cost is dominated by repeated full-payload JSON parses (cProfile). Planned fix: plan-index columns in the entries table. | C (profile), S (fix) | review lane LEDGER | Profile before blaming the validator. |
| 9 | **An adversarial review of a gate should fuzz it.** 30,000 mutation runs (NaN, inf, 1e999, unicode, truncation) produced zero uncaught exceptions and no wrong admit of a forbidden node; the defects were conformance and hardening, not bypass. | C | gate lane `fz.py` | Report what could not be broken, with the probe. |

## 2. Reusable pieces (in x3d.accrete)

* `tools/export_static.py`: verifies an archive, refuses an unverifiable one, writes a deterministic static payload, `--check` fails when the payload is stale.
* `web/static-mode.js`: one `fetch` shim that makes a live-server UI run from files; on loopback a live server wins, elsewhere static is used, `?static=1` forces it.
* `tools/pages_smoke.js`: headless Chromium served under a project-Pages sub-path (catches root-absolute URL bugs).

## 3. What this does not prove

* The original Claude-Haiku-in-artifact design (38 gate tests, prices, 1.2 M patch capacity) is **S**: the private source was never supplied; nothing here ran it.
* Rendering is an illustrative X_ITE 16.6.0 view under software GL; no candidate-bound render witness, no GPU timing.
* The browser verifier does not re-run the gate or the XSD/semantic validators.
* Pages is live only after the owner enables it (Settings, Pages, main, root); this note describes files, not a deployment state.
