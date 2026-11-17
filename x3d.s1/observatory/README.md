# Decision Observatory

A local X3D instrument for learning where typed judgments help an evidence-based scene workflow. It uses **authored synthetic probabilities**, not recorded or live JEV responses.

Run `run.bat` on Windows, `bash run.sh` in WSL/Linux/macOS, or `python3 server.py` from this folder (`x3d.s1/observatory`). Open http://127.0.0.1:8810/. Use `--port 8811` if that port is occupied. The server listens on loopback only and answers only to its own `127.0.0.1` and `localhost` host names (a rebinding page gets a 421). Python 3.12+ is the application dependency.

**Optional renderer.** The 3D preview pane uses X_ITE 16.6.0 (MIT), which is **not committed** (11 MB, 105 files). `python3 tools/fetch_renderer.py` downloads the pinned release over HTTPS and writes a file only when its size and sha256 match `renderer-manifest.json` (`--check` verifies what is on disk). Without it the pane says so and every exact observation, witness plan and routing view still works.

## Six experiments

1. Inspect the proof bench and expand its eight computed D-class answers. These describe source declarations.
2. Select the hidden or collapsed bench. A renderer can show why parsing and reference checks do not establish visibility. The required render witness stays `not_run`.
3. Select the missing bearing. Read the two local-reference findings and their narrower scope than a full semantic gate.
4. Select counterfeit instructions, then inspect the state slice. The metadata is inert scene data and excluded from the question state.
5. Move P(continue) between .20 and .98. Compare selected-option probability with concentration. Observe order changes and fixed witness membership.
6. Export a rehearsal. Recompute it with `python3 rehearsal.py verify path/to/record.json`, then edit/re-hash a witness status and verify that replay rejects it.

## Records and boundaries

`rehearsal.py` emits deterministic `x3d.s1.rehearsal/1` records with full candidate, question, state, policy and instrument hashes. `acceptance_eligible` is always false. Verification checks exact local replay; it does not authenticate an instrument, run the external Loom kit, or confer acceptance authority. The server refuses collection after its source code changes; restart it to load and bind the new implementation.

The bounded JSON hash profile is `x3d.s1.rehearsal-c14n/1`: sorted keys, compact UTF-8 JSON, finite numbers, and integral floats normalized to integers (including negative zero). It is not RFC 8785/JCS. Verify after parsing with the supplied implementation. This preserves identity when a browser export changes `1.0` into `1`. Exact replay also records the Python version: use the interpreter that ran the server.

The preview only loads the six authored, allowlisted local scenes. They contain no Script, Inline or external resource URLs. The app does not accept arbitrary scene URLs, ask for credentials or instantiate a hosted model transport. Source text is displayed as text. Its local HTTP endpoints are application plumbing, not JEV requests.

The prospective preview profile requires schema, semantic and rendered-visibility instruments; the release rehearsal adds reference comparison and release provenance. These are explanatory profiles, not replacements for registered Loom profiles. Priorities use authored unitless weights, not measured cost, latency or learned risk.

## CLI and tests

```sh
python3 rehearsal.py catalog
python3 rehearsal.py run --scene clean-rig --p .85 --threshold .8 --out rehearsal.json
python3 rehearsal.py verify rehearsal.json
python3 rehearsal.py build-examples
python3 -m unittest discover -s tests -p 'test_*.py'      # 31 tests
python3 -O -m unittest discover -s tests -p 'test_*.py'
```

The six committed examples can be rebuilt byte-for-byte with the same code and Python version. Code changes or a different Python version alter the recorded instrument identity; regenerate deliberately. Normal operation does not require external checkouts, vendor SDKs, pytest or lxml.

The field guide (`web/field-guide.html`, also linked from the app) explains the architecture. Renderer attribution is in `THIRD-PARTY-NOTICES.md`; the licence text is in `licenses/`. The rehearsal records hash the exact `x3d_s1` source beside this folder, so a change to the package changes the recorded instrument identity: re-run `python3 rehearsal.py build-examples` deliberately.
