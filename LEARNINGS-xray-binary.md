# LEARNINGS: the binary x-ray lens and Demo 74 (23 Nov 2026)

x3d.xray gained a second subject class: a **binary** instead of a repo family (`x3dray.binary`, Pass A + Pass B on x3d.xray main, commits aa45a52, 870df75, f0e4d87).
Demo 74 (x3d.demo `docs/demos/xray-binary/v1/`, PR #164) draws the result as a Blender-baked X3D 4.0 world.
Method credit: the hypothesis-debugging loop from ioma8, ["LLM assisted reverse engineering"](https://www.slowchronicle.com/posts/llm-assisted-reverse-engineering), Slow Chronicle, 18 Nov 2026.

## What was measured (grade C unless marked)

| quantity | value | instrument |
|---|---|---|
| hypotheses re-run, imported ledger H1-H5 + new H6 | 6/6 Confirmed; 5/5 agree with the import | x3dray.binary ledger, this container |
| keygen vs the real binary, run natively | 2000/2000 accepted; 200/200 one-digit mutants rejected | seeded native oracle |
| "the debugger lies" | under gdb g_salt = 0xa5a5a5a5 and F104-7CB6 is accepted; natively it is rejected and 5470-E4D2 accepted | gdb 15.1, strace 6.8 |
| H6 (new): a software breakpoint on derive | with the ptrace shim, g_salt = 0x5a5a0000 exactly (only the int3 poison) | gdb 15.1 |
| RE witnesses re-run | 13/13 match (static 5, static-decode 1, trace 5, oracle 2) | gate re_witness |
| bake | 384 samples, 8.4 s on CPU for 19,652 faces | Blender 5.3.0 bpy wheel |
| X3D | XSD 4.0 valid, semantic 0 warnings / 0 errors (43 info) | x3d_mcp 4d433af |
| frames | 8/8 non-black, mean luminance 0.072 to 0.161 | X_ITE 16.7.1, Chromium 157, SwiftShader |

## Reusable ideas

1. **A hypothesis ledger is a witness carrier.** Each row (hypothesis, experiment, prediction, observed, verdict) becomes code; an imported verdict is display-only and the row must be re-earned here. This is the Loom's "name the validator behind every number" applied to an investigation instead of a scene.
2. **Four RE witness kinds** fit the existing witness contract: `static` (argv + sha256 of stdout), `static-decode` (bytes + decoder model + sha256 of the decoded output), `trace` (strace/gdb argv + env + extraction regex + the extracted value only, because raw debugger output carries pids), `oracle` (the real artefact run natively over seeded vectors plus mutated negative controls; the transcript sha256 is the witness). The oracle pattern transfers to any reconstructed X3D behaviour: run the real browser over seeded inputs, keep the transcript hash.
3. **Instrumented and native are different witnesses.** The crackme's whole lesson: a value read under a debugger is the value the program lets a debugger see. A witness must record its instrument, and a claim earned only under instrumentation is not the same claim natively (see failure mode 202).
4. **Gates carry over unchanged in shape.** `re_fact` (no digit outside a slot), `re_witness` (re-run, fail closed), `re_verdict` (no Confirmed without a re-run witness; disagreements listed), `re_scene` (record ↔ DEF both ways). Each returns `{status, summary, problems, scope}` like `x3dray.gates`.
5. **Bake stage addition:** a receiving surface must be gridded for a vertex bake to hold shadows (failure mode 203). Emissive parts set to emit during the bake light their neighbours for free (hot roofs warm the walls below).

## New failure modes (added to LOOM-v1.md as 199 to 203)

| # | Failure | Fix (rule) |
|---|---|---|
| 199 | Pass A as delivered had a backslash inside an f-string expression. It parses on Python 3.12+, is a SyntaxError on 3.10, and CI's matrix includes 3.10; the delivering agent's 7/7 ran on a newer Python | Before landing a delivered patch, parse every new file on the oldest Python the CI matrix names (`uvx --python 3.10 python -c "import ast..."`) |
| 200 | The fact gate flagged a claim whose slot was named `{int3}`: the placeholder pattern allowed only letters and underscores, so the digit read as a number outside a slot | The gate's placeholder pattern and the template grammar must be one pattern; test with a digit in a slot name |
| 201 | Witnesses bind argv, so a ledger produced from a scratch directory carried absolute machine paths (the binary, the LD_PRELOAD shim) into a file bound for a public repo | Run producers from a work directory with relative paths, pass probes relative to the working directory, and sweep every receipt for `/tmp`, `/home` before publishing |
| 202 | The imported ledger's H3/H4 were measured under gdb; a reader could take "the serial is X" from a debugger dump as the native answer, which is exactly the trap the target sets | A witness names its instrument; a value observed under instrumentation is re-earned in the uninstrumented run before it is quoted as the artefact's behaviour |
| 203 | The first bake left the ground without building shadows: the plinth top was one quad, and a vertex bake holds four values on it | Grid every surface that receives shadow or occlusion before a vertex bake (88 cuts here: 17,251 ground faces, +1.2 MB); check a close frame for contact shadow |

## What was not tested

The stripped build (trace probes read the `g_salt` symbol); other binaries; Windows/macOS/ARM; real GPUs; other X3D browsers.
