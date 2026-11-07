# Rebuild review: <scene> rebuilt by <who>, <date>

Use when another model or person rebuilds a Loom scene in a different renderer or style (LOOM-v1 step 9; laws 38 to 40). Grade every line C, L or S and name the instrument.

## 1. Inputs
| Item | sha256 | Files | How read |
|---|---|---|---|
| Our master scene | | | |
| Their zip | | | |
| Their patch | | | |

## 2. Source and master
- [ ] Our scene survived byte for byte (sha256), or every change is listed
- [ ] Their renderer reads the master / a converted copy (law 38). If a copy: how is it checked against the master?
- [ ] Everything they draw that the master does not hold (geometry, lights, sky, objects)

## 3. Critiques, both ways
| Critique | By | Held / fell | Instrument | Fix lands in (generator, trap, page, local taste) |
|---|---|---|---|---|

## 4. Enhancements
| Enhancement | Adopt / adapt / keep local | Why | Where it goes |
|---|---|---|---|

## 5. Under the host
- [ ] Page runs under the host's policy; every fallback announces itself (law 40)
- [ ] Saves and exports use the host's save capability (page trap anchor-download-hosted)
- [ ] Labels for decoration, generated imagery and exaggeration travel with exported pixels (law 39)

## 6. Fold
- Scene fixes: generator commit
- Renderer facts: `kit/loomkit/traps.py` rules, runtime-labelled, two-sided tests
- Page facts: `kit/loomkit/pagetraps.py` rules
- Claims of ours that fell: retracted in the record
- Not proved: real GPU, their own records not re-run
