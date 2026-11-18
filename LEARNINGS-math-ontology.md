# Learnings: math and physics pedagogy ontologies (OntoMathPro, OpenMath, MathML, PhySH)

Fold-back from x3d.demo `docs/demos/math-concept-graph/v1/`. Fetched live 18 Nov 2026 from a build container (curl via agent proxy). Validators: x3d_mcp `fa5dccf` `validate_xml` and `validation.semantic`; rdflib 7.6.0; browser headless Chromium, SwiftShader, X_ITE 16.6.0. Grades: **C** run here, **L** published, not re-opened, **S** suspected. Local IDs `MO-n`.

| ID | Lesson | Evidence | Grade |
|---|---|---|---|
| MO-1 | **OntoMathPro exposes no RDF to a client.** `http://ontomathpro.org/ontology` returns an HTML class listing (3450 classes, 737 with Russian-only labels); asking for turtle gets the same HTML and `/ontology/E1` returns 404 although the site says dereferencing works. Ingest means scraping the listing, or using the OWL Manchester file in the project's own repo (not read here: outside this session's repo scope). | curl, 18 Nov | C |
| MO-2 | **A fifth of OntoMathPro is Russian-only.** Heat equation (E1921), Taylor series (E3071), Fourier series (E3079) and derivative of a function (E3040) carry only Russian labels, so English matching alone silently misses core calculus. | listing, 737 of 3450 | C |
| MO-3 | **OpenMath covers algebra and calculus, not statistics or physics lessons.** `prob1` and `stats1` return 404; no symbol matches fourier, taylor, series, wave, singular, bayes, probab, sampl, refract, regress or lagrange across 1537 symbols. Calculus (diff, defint), linalg (determinant, eigenvalue, eigenvector), veccalc (grad, divergence, curl) and complex1 are present. | symbols index + regexes | C |
| MO-4 | **MathML 3 content markup is thinner than OpenMath:** diff, int, determinant, matrix, grad, divergence, curl, arg, mean, variance appear; Fourier, Taylor, eigenvalue, Laplacian do not. | chapter 4 element counts | C |
| MO-5 | **PhySH is CC0 with a working JSON API but is a headings scheme, not a physics-concept ontology.** 544 concepts gathered; Chaos is exact for the Lorenz lesson, nothing exact for refraction, heat conduction or sampling. | physh.org/licensing, /concepts | C |
| MO-6 | **Coverage of the 18 Math Lab lessons by at least one Confirmed link:** OntoMathPro 11, OpenMath 6, MathML 6, PhySH 1. Nine lessons have no OpenMath link at all (fourier, lorenz, taylor, waves, bayes, aliasing, heat, refraction, least_squares). | coverage.json | C |
| MO-7 | **The semantic check catches what the XSD misses.** A `MetadataSet` directly under a Transform needs `containerField="metadata"`; the XSD passed it, `validation.semantic` flagged 18 errors. Run both. | x3d_mcp fa5dccf | C |
| MO-8 | **The graded-claim pattern ports from heritage to math unchanged:** one mapping list emits X3D `MetadataSet` per claim and JSON-LD (skos match + x3d:grade). SPARQL over it: Suspected links by lesson gave waves 2, svd 2, lagrange 1, aliasing 1, vector_field 1. | rdflib 7.6.0 | C |
| MO-9 | **False friends exist and should be recorded:** `E1041 Fermat number` for refraction (Fermat principle), `E2698 Vector function` for vector field, PhySH `Nonlinear waves` for linear superposition. | mapping.py grade S | S |

## Gobbler ingest, ranked
1. PhySH (CC0, JSON). 2. OEIS (CC BY-SA 4.0 read at oeis.org/LICENSE; `search?q=id:A000045&fmt=json` returned the Fibonacci record). 3. OpenMath symbols and CDs. 4. arXiv API (200 for physics.ed-ph and math.HO; metadata only, per-paper licence for figures: S). 5. OntoMathPro listing (licence unknown: S). 6. Open textbooks (CC BY 4.0 published, not re-opened: L).

## Next (proposed)
Link Math Lab lessons to Wikidata Q-ids (CC0); add a Russian-reader check of the 12 Russian-only labels; extend to physics lessons (Ten Minute Physics ports) against PhySH and the OpenMath SI/units CDs (`SI_DerivedQuantities1:heat` exists).
