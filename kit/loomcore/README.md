# loom-core: one claim shape over every demo dialect

The demos write claims in their own vocabularies. Measured on x3d.demo @ 7a8c0ba (20 Nov 2026):

| Dialect | File | Grade lives in | Scale |
|---|---|---|---|
| heritage-crm | `heritage-geo/v3/claims.jsonld` | `crm:P2_has_type` | IRI `urn:x3d:grade:C/L/S` |
| mathlab | `math-concept-graph/v3/claims.jsonld` | `x3d:grade` | IRI `urn:x3d:grade:C/L/S` |
| medprov | `medical-provenance/v7/claims.jsonld` | `urn:x3d:medprov:grade` | literal `C/L/S` |
| gobbler-px | `gobbler3-webgpu/v1/graph-v3.jsonld` | `px:grade` | literal `Confirmed/Likely/Suspected` |
| giza-atlas | `blender-giza-numbers/v4/receipts/atlas.json` | `number`, `design` | 5 values and 4 values |

`normalize.py` reads each through a small table and writes one shape (`context.jsonld`, checked by `claims.shacl.ttl`):
`grade` (C, L or S: strength of evidence), `verdict` (supported, refuted, untested), `gradeNative` (the value as written),
`sha256` (of the claim object as found, canonical JSON), and `source` / `instrument` / `derivedFrom` / `part`.

```
python3 -I kit/loomcore/normalize.py mathlab=path/to/claims.jsonld --out DIR --commit <sha>
python3 kit/loomcore/normalize.py --check kit/loomcore/normalized      # needs rdflib and pyshacl
python3 -I kit/tests/test_loomcore.py                                  # standard library only
```

Result in `normalized/` (`REPORT.json` lists every id repair):

| Dialect | Claims | C | L | S | refuted | untested | id repairs |
|---|---|---|---|---|---|---|---|
| heritage-crm | 19 | 9 | 4 | 6 | 0 | 0 | 0 |
| medprov | 9 | 4 | 3 | 2 | 0 | 0 | 9 relative |
| mathlab | 116 | 66 | 39 | 11 | 0 | 0 | 10 with a space |
| gobbler-px | 162 | 58 | 4 | 100 | 0 | 0 | 0 |
| giza-atlas | 63 | 30 | 22 | 5 | 5 | 1 | 0 |
| **all** | **369** | **167** | **72** | **124** | **5** | **1** | **19** |

369 of 369 conform to the shapes (rdflib 7.6.0, pyshacl 0.40.2), and one SPARQL query now counts grades across all five.

Choices made here, open to change:
- `False` in the Giza atlas is a **refuted claim**, not a fourth grade; `Untested` has no grade. Neither is forced onto C/L/S.
- The atlas `design` scale (Designed, Coincidence, Possible, Unknown) is a different question from evidence strength. It is kept under `gradeNative` and not mapped.
- The namespace is the URN `urn:loom:core:` so that no web address is claimed before one exists.
- An id with a space is split at the first space (IRI kept, the rest becomes `locator`); a relative id goes under the dialect's base.

Limits: the demo files themselves are unchanged (a demo version is never overwritten), so each demo should write through this shape in its next version. The hash covers the claim object, not the evidence it cites. The other 10 space-holding ids in the math file sit on lesson nodes (`skos:exactMatch`), which are not claims and are not rewritten here.
