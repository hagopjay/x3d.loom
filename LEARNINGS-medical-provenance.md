# Learnings: medical frontier (FMA, SNOMED CT ids, H-Anim on the torso)

Fold-back from x3d.demo `docs/demos/medical-provenance/v1/`. Educational proof of concept, not medical advice. Validator behind every scene claim: x3d_mcp `fa5dccf` `validate_xml` (XSD 4.1). Render checks: headless Chromium, software GL, X_ITE 16.6.0, not a performance number. Grades: **C** checked in the build, **L** third-party or earlier build, **S** judgement, scope doubt or gap. Local IDs `MP-n`; renumber on promotion to LOOM-v1.md.

| ID | Lesson | Evidence | Grade |
|---|---|---|---|
| MP-1 | **Mapping existence and mapping meaning are two claims.** An exact-label hit in FMA proves the class exists (C, 120 of 120 attempts). Whether the mesh *is* that class is a name judgement (L for 103, S for 18). Record both, with different grades. | `claims.json` kinds `fma-term` vs `denotes` | C |
| MP-2 | **Segmentation labels are names, not classes.** Scope mismatches (small bowel vs duodenum, colon vs rectum, merged portal and splenic veins, iliac extent, sets such as pulmonary veins) are exactly where the grade drops to S. | 18 S denotes claims | C |
| MP-3 | **A crosswalk chain beats a single lookup.** FMA to Wikidata (P1402, one item per id, 117 of 117) to Uberon to SCTID/MeSH/UMLS. Uberon's own FMA xref agreed with the start id for all 82 reached (0 disagreements), which is a free consistency check. | OLS4 and Wikidata SPARQL fetches in `data/ledger.json` | C |
| MP-4 | **Left/right is where chains break.** FMA has Left and Right classes; Uberon and SNOMED often one bilateral class, so 42 of 120 shapes (24 ribs, paired bones and veins) got no SNOMED id. A gap, not proof of absence. | `structures.json` | L |
| MP-5 | **H-Anim is a skeleton vocabulary.** 146 segment names in the X3D 4.1 XSD: vertebrae, skull, sacrum, pelvis, clavicle, scapula, arm and leg segments. No ribs, sternum, costal cartilage or organ. 37 of 121 shapes map; hip bone to pelvis is loose (L). | XSD parsed by `build.py` | C |
| MP-6 | **Injected `metadata` as first child of Shape validates** (XSD requires metadata before Appearance, as with Transform, see HG-2). 121 MetadataSets, both scenes 0 errors; source scenes were valid before. Validation time 2.4 s for a 2.8 MB torso. | x3d_mcp `fa5dccf` | C |
| MP-7 | **Cache raw bodies and log a ledger.** 202 fetches (url, sha256, bytes, time) make the build re-runnable offline and let a reviewer re-check any claim. | `data/cache/`, `ledger.json` | C |
| MP-8 | **Do not copy what you can reference.** The new scenes need textures from the older folder; rewriting `tex/` to a relative path to `brain-torso-xite/v1/scenes/tex/` kept the repo at 5.8 MB for the folder. | build step | C |
| MP-9 | **Licence texts on one site can disagree.** BodyParts3D info page says CC-BY SA 2.1 JP; lic.html (2025/02/27) says CC BY 4.0. FMA: OBO registry CUSTOM (inactive), OLS none. Follow the newer text, flag the conflict, ship ids only. | pages read 18 Nov 2026 | C |
| MP-10 | **Dataset licence upgrade.** Zenodo 10047292 (TotalSegmentator, 117 structures, 1228 CT) states cc-by-4.0; the earlier torso notice said Likely. Subject s1397 membership and the pyvista copy stay L. Zenodo answered from the container this time (an earlier note said blocked). | record JSON | C |
| MP-11 | **Small structures are voxel-limited.** One 3 mm voxel is 0.027 mL; structures under 5 mL (adrenals, ribs 11 and 12) carry S on their volume. | 4 claims | C |

## Open sources, ranked for the next step
| Rank | Source | State |
|---|---|---|
| 1 | BodyParts3D meshes keyed by FMA id (112 of 120 classes listed) | lists fetched, meshes not downloaded; CC BY 4.0 per newer page |
| 2 | TCIA DICOM for a VolumeData demo (156 collections, API answers) | licence per collection unread |
| 3 | NIH 3D | per-model licences unread; no API path found |
| 4 | SNOMED CT proper | needs an affiliate licence; ids only today |

## Next builds (proposed)
HAnimHumanoid with joints on the 37 mapped bones; SegmentedVolumeData whose segment ids are FMA classes; SPARQL over `claims.jsonld`; swap in BodyParts3D meshes where the class is covered and compare to the CT surfaces.
