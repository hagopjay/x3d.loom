# Learnings: heritage and geospatial frontier (CIDOC-CRM, Giza, Burruss Hall)

Fold-back from x3d.demo `docs/demos/heritage-geo/v1/` (x3d.demo PR #61, candidate Demo 46). Validator behind every scene claim: x3d_mcp `fa5dccf` `validate_xml` (XSD 4.0). Render checks: headless Chromium, software GL, X_ITE 16.6.0, not timed. Grades: **C** run here, **L** published and not re-opened here, **S** suspected or a design proposal. Local IDs `HG-n`; renumber on promotion to LOOM-v1.md.

## Lessons

| ID | Lesson | Evidence | Grade |
|---|---|---|---|
| HG-1 | **A grade is a first-class claim record.** Model each claim as a CRM E13 Attribute Assignment (P140 assigned attribute to, P141 assigned, P2 has type = grade). In X3D it is a `MetadataSet` per claim under the object, and the same claims export as JSON-LD (`claims.jsonld`, 7 nodes parse). | `build.py` writes both from one list, so they cannot drift | C |
| HG-2 | **In the X3D 4.0 XSD, `metadata` must be the first child of a Transform or GeoLocation.** Placing the `MetadataSet` after the Shape gave 5 errors ("This element is not expected") from the validator; moving it first gave valid, 0 errors. | x3d_mcp `fa5dccf` | C |
| HG-3 | **GeoLocation content needs no extra rotation for Y-up content.** A +90 degree X rotation stood the Drillfield on edge; with identity rotation it drew flat and in place. | screenshots, X_ITE 16.6.0 | C |
| HG-4 | **GD is lat, lon, elevation; WKT, GeoJSON and GeoSPARQL default are lon, lat.** Swapping is the cheapest silent failure in any geo import. | spec convention; Pleiades GeoJSON returned [29.91, 31.20] for Alexandria, which reads as lon, lat | L |
| HG-5 | **Geometry status and evidence tier stay separate here too** (Giza Atlas GZ-1). The pyramids are box pyramids with published dimensions (L), so the page says "schematic" beside every grade. | page header and c6 | C |
| HG-6 | **Two datums disagree and nobody has said which is right.** USGS EPQS 1 m returns 627.175 m at 37.2284 N, -80.4234 E; the Drillfield world uses 617 m as its reference. Unreconciled (point on a slope or building, a datum difference, or both). | EPQS rasterId 58593 | S |
| HG-7 | **A scout must record failures as facts about the container.** Overpass gave no answer on two mirrors from the build container; the row says so and does not call it down. Three Wikidata queries returned 0 rows with HTTP 200, so the cause is not isolated. | `data/open-data-sources.json` | C |
| HG-8 | **Count classes with the ontology's own tooling, not a regex.** A regex over CIDOC_CRM_v7.1.3.rdf found 76 `rdfs:Class`, 309 `rdf:Property`, 75 distinct E-numbers; this was not reconciled with the official class list. | 713,673-byte file | C count, S meaning |

## Open-data scout, ranked for the next step

| Rank | Source | Why | State |
|---|---|---|---|
| 1 | USGS 3DEP (EPQS and TNM, 1 m DEM) | Free, keyless, answered here; gives `GeoElevationGrid` for Burruss | C |
| 2 | Existing `confluence-ifc/v1` model.ifc (500,619 bytes) | IFC to X3D already built; place it with an IfcMapConversion-derived GeoLocation | C (recorded) |
| 3 | Smithsonian 3D API | Answers; Egypt rows exist, per-item rights vary | C |
| 4 | Europeana (own key, not the demo key) | 3D items with rights statements; "pyramid" 3D total 12 | C |
| 5 | Pleiades | Gazetteer ids and CC BY coordinates for sites; the Giza id still to find | C fetch |
| 6 | OSM Overpass | Needs a route that works from this container | not reached |
| 7 | buildingSMART IFC samples | Repository outside this session's GitHub scope | not run |

## v2 additions (x3d.demo PR #63, heritage-geo v2)

| ID | Lesson | Evidence | Grade |
|---|---|---|---|
| HG-9 | **Coordinates typed from memory are not evidence; read them from a gazetteer.** v1 put Khafre 208.3 m and Menkaure 64.1 m from their Pleiades points (Great Pyramid 4.7 m, Sphinx 4.3 m). v2 reads the points from the Pleiades dump and puts the Pleiades id on each claim (CRM P87 is identified by). | Pleiades dump dated 17 Nov 2026, 42,542 rows, sha256 75f620a7...; `data/pleiades-giza.json` | C |
| HG-10 | **Compare like with like before calling a datum conflict.** EPQS 627.175 m at one point versus the Drillfield's 617 m tile reference looked like a 10 m disagreement. Over 140 points at 30 m spacing the median of EPQS minus (617 + DSM) is +0.03 m, and tile ground spans 619.8 to 632.9 m, so 627.175 m was one slope point. Caveats: tile centre assumed, correlation 0.51, DSM includes buildings and trees (min difference -24.2 m). | USGS EPQS 1 m, `reconcile_elevation.py` | C numbers, S interpretation |
| HG-11 | **Check the model before promising a placement.** `confluence-ifc` model.ifc has IFCSITE with every placement and lat/lon field null and no IFCMAPCONVERSION or IFCPROJECTEDCRS, in millimetres. The placement row (EPSG:32617, Scale 0.001) is authored here and graded S. | grep over 2,030 lines | C file, S placement |
| HG-12 | **Test the orientation hypothesis both ways.** The Drillfield DSM matches EPQS with z increasing southward (corr 0.51) and not northward (-0.40). | 140 samples each | C |
| HG-13 | **A new version of a squash-merged branch needs the base merged in**, or the PR re-lists the earlier version's files. Merging main into the branch cut the PR diff to the new folder. | git, x3d.demo #63 | C |

## Next builds (proposed)
1. `GeoElevationGrid` for the Drillfield from a 3DEP tile, with the 627.175 vs 617 m question answered.
2. Run `model.ifc` through the Confluence path and place it with a documented IfcMapConversion row.
3. A Giza DEM-based ground and Pleiades ids on each claim (P87 is identified by).
4. One accountable query per claim: "show every Suspected claim on the Sphinx" as a SPARQL over `claims.jsonld`.

## Licence
Burruss Hall and Drillfield are Google Solar API data, reused for an academic, non-commercial proof of concept only, by the owner's decision (18 Nov 2026). Do not reuse commercially.
