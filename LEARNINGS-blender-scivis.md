# What the Blender scientific-visualization integration review teaches (17 Nov 2026)

Source: a private review of the Blender sci-vis knowledge base and 27 bridge proposals, plus its v2 package (adapters, ontology hooks, two Blender probes). Technical subset published in https://github.com/hagopjay/x3d.STEM under `integration/blender-scivis/v2/`. Grades follow the Loom convention: **C** = a named tool ran in this fold-back, **L** = read or reasoned (including receipts the review carries), **S** = suspected. Environment of every **C** number: Linux x86_64, CPython 3.13.18. Every **L** number names the tool in its row.

## 1. Findings

| # | Finding | Grade | Evidence | Rule it suggests |
|---|---|---|---|---|
| 1 | **A one-line `re.sub` bug corrupted provenance JSON.** `re.sub` treats the replacement string as a template, so serialized JSON with `\n`, Windows paths or `\1`-like text was decoded or rejected. Fix: pass a callback (`lambda m: metas + "</head>"`). With 5 regression tests, **4 of 5 fail before the fix and 5 of 5 pass after**. | C | `unittest` on the patched and unpatched `src/x3dprov.py`, CPython 3.13.18 | Never pass data as a `re.sub` replacement string; use a callback. A regression test must be seen to fail first. |
| 2 | **Precision is a budget at the stored magnitude, not "orders of magnitude".** Blender 5.2.4 (build cd5dc428cce1), saved and reopened, read back against independent binary32 packing: direct max error 0.2345000003 m (ECEF-like) and 0.1543210996 m (UTM-like); with a binary64 origin kept outside Blender, 1.890585e-6 m and 1.890643e-6 m. | L | `probes/precision/precision-control.json` (Blender 5.2.4 LTS) | Center at a declared origin, keep the origin in binary64 outside the application, and say that moving the object back re-introduces the loss. |
| 3 | **Native splat import is a measured route, with a counterexample kept.** Blender 5.3.0 (build 02f0899d78e3) imported four asymmetric SH3 splats; 20 XML arrays checked; Apply Transform changed the represented covariance by 0.22836776 fixture units². | L | `probes/native53/results/native53-result.json` (Blender 5.3.0) | A splat is centre + covariance + opacity + directional radiance; preserved positions alone miss transform loss. Keep failure cases as regression targets. |
| 4 | **Separate the evidence record from the activity it describes.** Reading a Cycles receipt today is a new inspection, not a render today. The figure adapter records `link_existing_render` with `render_reexecuted: false`. | C | 8 adapter tests pass, CPython 3.13.18 | Name the operation (inspect, link, run) in every record; never upgrade an old run by re-reading it. |
| 5 | **A hash chain is not a signature.** The stale-input case verified a chain that should have been refused; the adapter now refuses stale or broken input before extending. Hash methods must keep their names (exact bytes vs canonical JSON vs scene content). | C (refusal), L (old behaviour) | 13 inventory + 8 adapter tests pass | A 64-hex string is not a universal identity; carry the method name beside it. |
| 6 | **Support is scoped, not transitive.** `prov:wasDerivedFrom` expresses lineage only; claim support needs listed evidence, facet, mode and freshness. SHACL checks metadata structure, not truth. | C | inventory tests (scope, drift, root containment) | Query "which unchanged records support this narrow claim", never "is it true". |
| 7 | **The backlog consolidates.** 27 historical bridge proposals map to 8 work packages (WP0 recovery to WP7 capability watch). | L | review catalog (private) | Freeze baselines, close one exchange loop, then splat ladder, then domains, then orchestration, models last. |

## 2. Reusable pieces

* `integration/inventory.py`: read-only JSON-LD evidence inventory; `verify` fails on missing or changed bytes. Standard library only.
* `adapters/x3dprov_link.py`: retrospective figure link over the existing x3dprov protocol (no second provenance scheme).
* `ontology/`: PROV/SOSA/QUDT/SKOS hooks, SHACL shapes, a SPARQL support query, and a malformed-SHA negative control.

## 3. What this does not prove

* The Blender 5.2.4 and 5.3.0 results are reported by the review; Blender was not run in this fold-back. No renderer PSNR or large-splat result exists.
* The inventory importer expects a `studies/research-loom` tree that is not in x3d.STEM.
* Rights, corpus and bridge-audit material stays private and is not summarised here.
