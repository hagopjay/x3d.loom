# The offline judgment observatory and the Loom

This edition applies the JEV exploration's typed-question ideas without an account, API key, model request or simulated claim of measured model reliability. Its fixture values are **Authored / Synthetic**. Expected outcomes in `manifest.json` are lesson definitions, not observations from a validator or renderer.

The Loom conventions below are derived from the November 2026 Jev exploration (x3d.docs chapter 22, and the Loom conventions in `LESSONS-v1.0.md` and `LOOM-v1.md` at this repository's root). They describe that snapshot, not later changes.

## What belongs in each lane

| Lane | Useful work now | What the result establishes |
| --- | --- | --- |
| D: decidable source inspection | Parse the supplied XML, enumerate declared nodes and local references, inspect switches and transforms, compute a bounded slice. | Properties of these exact source bytes under the named inspection code. It does not establish the instantiated scene or its appearance. |
| C: existing instrument | Plan XSD, semantic, rendering and comparison witnesses; import a result only under its stated provenance contract. | The named instrument's scoped result, if it actually ran against the current candidate. Otherwise its status remains `not_run`. |
| J: judgment without an exact twin | Rehearse a closed Choice, Noul or Score and display routing behavior using explicitly synthetic answers. | Behavior of the routing code under authored inputs. It establishes no JEV calibration, accuracy or latency. |

This folder is not a validator or an MCP server, and the `scene_brief` tool in x3d_mcp is not run here. A successful local XML parse cannot stand in for an unavailable XSD or semantic witness. Nor does an attractive preview automatically establish measured visibility: that claim needs a recorded renderer run with its camera, scene bytes, engine and configuration.

## Acceptance stays outside the advisory lane

For a fixed candidate and profile, changing an advisory answer may change the order of work. It must not change the required evidence set:

```text
required(candidate, profile, advisory_A)
    == required(candidate, profile, advisory_B)
```

An acceptance function should consume candidate-bound witness records and a named profile, with no model-answer argument. A scheduler may rank which witness to run first. An exact failure may stop later work while leaving those witnesses visibly `not_run` and producing no accepted-artifact receipt. A high probability cannot convert missing evidence into `pass`.

The Loom policy keeps model output at **S / suspected** and numerical judge output in labelled experiments. A synthetic rehearsal is also clearly labelled; it does not resolve or relax that policy. A result whose arithmetic was executed locally can document that arithmetic while its model-reliability claim remains unmeasured.

## Six controlled fixture lessons

| Fixture | Deliberate change | Intended lesson |
| --- | --- | --- |
| `clean-rig.x3d` | A small, lit teal-ceramic and bronze proof bench with a slow rotating wheel. | A surviving control makes failures interpretable. Its visible appearance remains an expectation until rendered. |
| `hidden-switch.x3d` | All drawable geometry is inside `Switch whichChoice='-1'`; cameras and lights remain outside. | Nodes in a source document do not guarantee selected drawable content. |
| `zero-scale.x3d` | All drawable geometry is inside a transform with scale `(0, 0, 0)`. | A source can parse and keep correct local references while its geometry collapses. |
| `broken-reference.x3d` | One dangling `USE` and one ROUTE endpoint name a missing DEF. | Well-formed XML is weaker than a valid reference graph. The control should fail for the intended reference diagnostic. |
| `untrusted-notes.x3d` | The control gains instruction-like text in a `MetadataString`; its geometry is unchanged. | Scene text is data. It supplies no authority to promote a grade, change witnesses or accept an artifact. |
| `empty-geometry.x3d` | A Shape has an Appearance and no geometry. | A parsed document need not contain a visible object. |

All six scenes are self-contained X3D XML. They use no Script, Inline, external resources or image textures. Their geometry and materials are authored teaching assets, not scans or physical measurements. The empty fixture's missing geometry and the broken fixture's references are deliberate controls, not accidental defects to repair silently.

## Bind observations to what was seen

A reproducible local result should identify the candidate's full SHA-256; the inspection-code identity; the question, slice and policy identities; scope and excluded information; and the actual instrument used. Short hashes are useful display labels, while full digests belong in exported records.

A hash answers which bytes were used. It does not authenticate a publisher or turn an imported claim into an independent observation. Caller-supplied oracle results must not silently become server-minted evidence. A replay record is useful when its origin and bindings remain explicit; a miss or stale binding is an error, not an invented default answer.

Likewise, a dropped facet is missing evidence. A light-count question cannot receive an exact "no lights" result merely because its input slice contains only the header. This is the Loom's "unknown is not zero" rule applied to budgeted scene inspection.

## High-value next steps that need no JEV API

1. Keep the D/C/J partition executable and refuse exact answers with missing prerequisites.
2. Record the required witness plan independently of synthetic probability controls; test noninterference across adversarial answers.
3. Bind imported results to the candidate and instrument identity, while stating the limits of local provenance checks.
4. Run both surviving and failing controls, requiring the intended diagnostic rather than counting an instrument crash as a catch.
5. Keep source parsing, semantic validity, rendered visibility and design intent as separate observations.
6. Preserve historical corpus figures separately from newly executed local checks.

When an API later becomes available, the same fixture and record contracts can support an explicitly authorized experiment. Real model answers would still require a pinned model identity, recorded requests, declared limits and a held-out evaluation split before any scoped reliability claim. Synthetic rehearsal results must never be mixed into that measured corpus as though a model produced them.
