# x3d.style: a style vocabulary and grammar for X3D

One scene, many looks, one grammar. **[SPEC.md](SPEC.md) is the document**; this page is the map.

A style is a small JSON-LD sentence of ten parts of speech (palette, surface, light, air, line, form, type, motion, encode, view). A scene carries roles and data only. `compile(scene, style)` gives X3D 4.0 and writes the style back into the file as Metadata. Fourteen rules decide whether a style is valid, and each rule is a measurement.

| path | what |
|---|---|
| [SPEC.md](SPEC.md) | vocabulary, grammar, operators, findings, evals socket, ontology |
| `src/color.mjs` | sRGB, OKLab, WCAG contrast, colour-vision simulation; no dependencies |
| `src/grammar.mjs` | the 10 parts, 48 tokens, `lint` (G1..G14), `transpose`, `mix`, `invert`, `flatten` |
| `src/repair.mjs` | the deterministic baseline optimizer |
| `src/compile.mjs` | scene + style → X3D 4.0 text |
| `src/evals.mjs`, `bin/eval.mjs`, `evals/dspy_socket.py` | tasks, metric, baselines; the DSPy seam, switched off |
| `styles/authored.jsonld` | the 12 styles as first written |
| `styles/kuhn-landscape.style.json` | `xst:kuhn-landscape`, the first style borrowed from a source figure (10 categorical colours): authored, repaired, both lint records. Kept outside the 12-style catalogue so the matrix and vocabulary counts that Demo 75 quotes do not move; joining the catalogue as the 13th is the owner's call (A Landscape of Consciousness, 25 Nov) |
| `styles/catalogue.jsonld` | the 12 styles after lint and repair (generated) |
| `vocab/` | JSON-LD context, OWL + SKOS vocabulary, SHACL shapes (generated from the grammar) |
| `data/node-city.scene.json` | the abstract scene: 260 X3D nodes as a city (`tools/build_scene.py`) |
| `tools/` | scene builder, XSD + semantic validation, RDF and SHACL check, glTF round trip |
| `tests/style.test.mjs` | 11 tests: `node --test tests/style.test.mjs` |

Live: Demo 75, Style Loom, in x3d.demo (`docs/demos/style-loom/v1/`), which compiles every world in the page.

Headline numbers (23 Nov 2026; instruments in SPEC.md): 12 of 12 worlds XSD 4.0 valid; 4 of 12 authored styles failed the grammar first time, the incumbent Neon Noir among them; 288 style × palette × inversion sentences checked, 104 valid as written, 158 after repair; style metadata survives X3D → glTF `KHR_xmp_json_ld` → X3D for 12 of 12 worlds; evals dev baseline 0.646 against a ceiling of 1.0.

`out/` is build output and is not committed; rebuild it with the commands in SPEC.md section 10.
