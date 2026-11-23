# Learnings: the style vocabulary, the style grammar and Demo 75 (23 November 2026)

The ask: the data demos all wear the neon night city. Explore other looks, learn what X3D can do, and distil a shareable vocabulary and grammar of style that is abstract, scales, and plugs into an ontology; then give it an evals socket an optimizer can use. The kit is `x3d.style/`; the spec is [x3d.style/SPEC.md](x3d.style/SPEC.md); the live page is Demo 75 in x3d.demo.

Grades: C Confirmed (re-run here), L Likely, S Suspected.

## What was built

| piece | size | check |
|---|---|---|
| vocabulary | 10 parts of speech, 48 tokens, 11 roles | generated into OWL/SKOS (555 triples) and SHACL (455) from the code |
| grammar | 14 rules, each a measurement | 11 unit tests, Node 22 |
| operators | transpose, mix, invert, repair | judged by the grammar on 288 sentences |
| catalogue | 12 styles | 12 of 12 worlds XSD 4.0 valid, 0 errors, 0 warnings (x3d_mcp fork 4d433af) |
| frames | 22, X_ITE 16.7.1, Chromium 157, SwiftShader | 12 of 12 styles land in the luminance band their `intent.key` declares |
| ontology round trips | X3D MetadataSet → tokens: 12 of 12 identical; X3D → glTF `KHR_xmp_json_ld` → X3D: 12 of 12 pass S0..S6 | rdflib 7.6.0, pyshacl 0.40.2, x3dsem 0.1.0 |
| evals socket | 196 tasks, 1 metric, 3 model-free baselines, DSPy seam off | dev: identity 0.432, home-palette 0.501, repair 0.646, ceiling 1.0 |

## What it taught

1. **A default look is an unexamined claim.** Neon Noir, the look of a dozen demos, failed its first lint: blue `#6fb7e0` and violet `#c58ce0` sit 0.020 apart in OKLab under deutan simulation. Two colours moved by about 0.013 fixed it. Nobody would have found this by looking with normal colour vision. (C for the number, L for what a reader sees.) → failure mode 205.
2. **Four of twelve hand-written styles broke a rule**, and each break was a real defect once drawn: ink that sank into paper, a cream block on a cream plate, the riso pink and blue that merge for protan readers. Writing styles by taste and linting afterwards is the cheap order.
3. **The frame corrected the grammar.** G3 allowed "shading separates figure from ground". Inverting the Paper Maquette gave black on black, lint 10 of 10, frame luminance 0.011. The rule now requires a light body. The rule set is a witness and was wrong once already; expect more. → 206.
4. **Palettes are less portable than they look.** Of 144 structure × palette pairs, 71 are valid as written and 98 after repair. The usual break is the alert colour: a donor palette's alert is too close to a body colour of the new structure (G6, 79 cases). An alert colour is a property of the *pair*, not of the palette.
5. **Inversion is not a night mode.** 33 of 144 inverted sentences pass as written. Flipping lightness keeps hue and chroma, and saturated colours at low lightness lose their separation. A night mode has to be authored or optimized, and now there is a number to say how far off the automatic one is.
6. **A metric must be attacked before it is trusted.** The first evals metric paid more for discarding the input than for repairing it. Two baselines that take a minute to write (do nothing, throw it away) exposed it. → 207.
7. **Albedo-true exposure.** Scaling the lights so an up-facing surface receives exactly 1.0 makes the drawn ground equal its palette colour to the byte, removes the horizon seam, and makes palette measurements describe the frame. → 209.
8. **Material model changes colour space in X_ITE** (L), and **fog under a physical material washed the scene** (S). → 208.
9. **Where Metadata sits decides whether it travels.** `WorldInfo` metadata does not reach glTF; the root `Group` does. → 210.
10. **One name in three places.** `xst:palette_ground` is the X3D `MetadataString` name, the JSON-LD term and the RDF predicate. No mapping table exists because none is needed. The `.` that would have been natural in the name draws a validator warning.
11. **Generate the ontology from the code.** The context, the OWL file and the SHACL shapes come out of `PARTS` in `grammar.mjs`. The first SHACL run failed 84 times on one cause (JSON-LD numbers typed `xsd:decimal` with a double's lexical form); `xsd:double` fixed all of them.
12. **Looks that needed no shader.** Twelve distinct styles came from four material types, vertex colour, fog, one directional light with shadows, line sets and one prism generator. X3D 4.0's declarative surface is wider than the neon habit suggested. Not reached: patterns (hatch, halftone), which need `FillProperties` or `PixelTexture` and a new part of speech.

## Open

- One scene only. "Abstract" is not shown until a second, different scene goes through the same styles.
- No hardware GPU, no second engine, no reader with colour-vision deficiency, no learned optimizer.
- `repair` does not address G6, G8 or G14; 130 of 288 sentences stay invalid.
- Thresholds are engineering choices set before the run; none is calibrated against people.
