# X3D style vocabulary and grammar (`xst/1`)

**23 November 2026.** A way to say how an X3D scene should look, in words a person can read, a machine can check, an optimizer can climb, and an ontology can hold.

The data demos had settled on one look, the neon night city (Demo 74 is the latest). This spec separates *what a scene is* from *how it looks*, so the same scene can be dressed many ways and every way can be checked.

```
  scene (roles + data)          style (10 parts of speech)
  no colour, no light           JSON-LD, 48 tokens
            \                    /
             \                  /         lint: 14 rules, each a measurement
              v                v          operators: transpose, mix, invert, repair
            compile(scene, style)
                     |
                     v
        X3D 4.0 world  =  geometry + MetadataSet xst:Style (48 tokens) + xst:role tags
            |                      |                        |
        X_ITE frame          glTF KHR_xmp_json_ld        RDF (OWL / SKOS / SHACL)
     (luminance vs key)      (S0..S6 round trip)         (rdflib, pyshacl)
```

Grades used below: **C** Confirmed (re-run here), **L** Likely, **S** Suspected.

## 1. The idea in four sentences

1. A **scene** carries roles and data only: `ground, plate, mass, alert, hero, edge, link, packet, grid, label, sky`.
2. A **style** is one sentence made of ten parts of speech; it never names a mark, only a role.
3. A **grammar** of 14 rules decides whether a sentence is valid; every rule is a measurement with a threshold.
4. Four **operators** make new sentences from old ones, and the grammar judges what they make.

This is the same split as HTML and CSS, with two differences: the style travels *inside* the X3D file as Metadata, and it can be linted before anything is drawn.

## 2. Vocabulary: ten parts of speech, 48 tokens

| part | says | tokens | X3D 4.0 it compiles to |
|---|---|---|---|
| **palette** | which colours exist and what each serves | `ground plate mass ink accent alert haze` (colour), `sky categorical sequential` (colour lists) | `Color`, `Background`, `Fog.color`, material colours |
| **surface** | how a body answers light | `model` (unlit, phong, physical), `tint capTone roughness metallic opacity glow` | `UnlitMaterial`, `Material`, `PhysicalMaterial` |
| **light** | where light comes from, how much shade is baked | `azimuth elevation intensity ambient shadow contact relief` | `DirectionalLight` (`shadows`, `shadowIntensity`), baked vertex colour |
| **air** | what lies between eye and far masses | `fog` (none, linear, exp), `range` | `Fog`, `Background` |
| **line** | what is drawn as line | `edges` (none, ink, data), `weight`, `links` (line, tube), `linkInk` (ink, accent), `grid` (none, lines, rings) | `IndexedLineSet`, `LineProperties`, swept `IndexedFaceSet` |
| **form** | the shape of a mass | `sides taper tiers inset cap fill lift` | `IndexedFaceSet` from one prism generator |
| **type** | how labels are set | `family` (SANS, SERIF, TYPEWRITER), `size`, `case`, `density` | `Text`, `FontStyle` |
| **motion** | what moves and how fast | `pulse`, `flow` (seconds, 0 = still) | `TimeSensor`, `ColorInterpolator`, `PositionInterpolator`, `ROUTE` |
| **encode** | which data channel drives which visual channel | `hue` (category, value, mono), `alert` (color, glow) | drives `Color` values and the alert material |
| **view** | how the scene is first seen | `projection` (perspective, ortho), `start` (hero, plan, street) | `Viewpoint`, `OrthoViewpoint` |

Plus `intent { key: low | mid | high, mood[], use }`: what the author claims the style is for. The claim is checked twice: by rule G14 against the palette, and by the render receipt against the frame.

Three design choices keep the vocabulary abstract and scalable:

- **Tokens are roles and ratios, never node fields.** `surface.tint 0.3` means "30% of the data colour reaches the body". The compiler decides that this becomes a `Color` node. Another compiler could target glTF, USD or a game engine from the same sentence.
- **A palette is always complete** (rule G13: both a categorical and a sequential scale). That is what makes any palette fit any structure, so 12 styles give 144 transpositions without anyone writing them.
- **Shade that must not depend on the engine is baked into vertex colour** (`light.contact`, and `light.relief` for unlit styles). An unlit style looks the same in any reader.

## 3. Grammar

```
Style    ::= Palette Surface Light Air Line Form Type Motion Encode View
World    ::= compile(Scene, Style)
Style'   ::= transpose(Style, Style) | mix(Style, Style, t) | invert(Style) | repair(Style)
valid(S) ::= G1 ∧ G2 ∧ … ∧ G14          (a rule that does not apply is skipped, and says so)
```

| rule | says | measured as | fails among 288 sentences (section 6) |
|---|---|---|---|
| G1 | Complete sentence | every token of every part present and of the right kind | 0 |
| G2 | Labels are legible | WCAG 2.x contrast of ink on ground and on plate ≥ 4.5:1 | 0 |
| G3 | Figure separates from ground | body vs plate Delta E OK ≥ 0.10, or an edge line with contrast ≥ 1.6:1, or a light (L ≥ 0.5) lit surface with shadow + contact ≥ 0.8 | 76 |
| G4 | Categories are distinct | min pairwise Delta E OK ≥ 0.08, and ≥ 0.04 under deutan and protan simulation | 68 |
| G5 | Order reads as order | sequential ramp monotone in OKLab lightness, span ≥ 0.30 | 0 |
| G6 | Alert pops out | alert colour Delta E OK ≥ 0.15 from every body colour and from the plate | 79 |
| G7 | Accents are scarce | alert + hero marks ≤ 15% of marks (checked on the scene) | 0 |
| G8 | Glow needs night | if anything glows, ground OKLab L ≤ 0.35 | 36 |
| G9 | Light agrees with surface | unlit casts no shadow; lit has a key light | 0 |
| G10 | Air agrees with sky | fog colour within Delta E OK 0.08 of the horizon colour | 0 |
| G11 | Motion is restrained | pulse period ≥ 0.5 s (under 3 flashes a second, WCAG 2.3.1) | 0 |
| G12 | Plate is a quiet step | plate vs ground Delta E OK in 0.02..0.2 | 0 |
| G13 | Palette is portable | ≥ 4 categorical colours and ≥ 3 sequential stops | 0 |
| G14 | Declared key is honest | `intent.key` low: ground L ≤ 0.4; mid: 0.3..0.85; high: ≥ 0.75 | 24 |

Instruments: OKLab (Ottosson 2020) for distance and lightness; WCAG 2.x relative luminance for contrast; Machado, Oliveira and Fernandes 2009 matrices at severity 1.0 for colour-vision simulation. Thresholds were set once, before the 288-sentence run, and are in `THRESHOLDS` in `src/grammar.mjs`. They are engineering choices, not perceptual constants: **L**. The simulation is a model of dichromat vision, not a test with readers: **L**.

The structural half of the grammar (G1) also exists as SHACL (`vocab/xst.shapes.ttl`), so an RDF tool with no knowledge of this kit can reject a malformed style.

## 4. Operators

| operator | does | keeps | provenance written |
|---|---|---|---|
| `transpose(a, b)` | structure of `a`, palette and key of `b` | all 38 non-palette tokens of `a` | `operator: transpose`, `derivedFrom: [a, b]` |
| `mix(a, b, t)` | numbers and colours blend (colours in OKLab); words switch at t = 0.5 | nothing fixed: a continuum | `operator: mix`, `derivedFrom: [a, b]` |
| `invert(a)` | flips OKLab lightness of every palette colour, reverses the declared key | hue, chroma, structure | `operator: invert` |
| `repair(a)` | moves palette lightness the smallest distance that makes the grammar pass | hue, chroma, structure | `operator: repair`, drift reported |

`derivedFrom` is `prov:wasDerivedFrom` in the JSON-LD context, so a style's ancestry is ordinary PROV-O.

## 5. The catalogue: twelve styles, one scene

Scene: the **X3D node city**. 260 concrete X3D 4.0 nodes; district = component (36); height = number of declared fields (x3d.py 4.0.65.8); alert = the three.js bridge has not drawn the node yet (32); hero = `EspduTransform`, 73 fields; links = each component to Core (35).

| style | lineage | surface | hue encodes | key | X3D levers it leans on |
|---|---|---|---|---|---|
| Neon Noir | night city, vector display (the incumbent) | unlit | category | low | data-coloured `IndexedLineSet` edges, exponential `Fog`, pulse and packet `ROUTE`s |
| Blueprint | cyanotype engineering drawing | unlit | mono | low | `OrthoViewpoint` plan, ink edges, grid |
| Paper Maquette | architect's white card model | phong | mono | high | `DirectionalLight` shadows, contact shade |
| Ink Wash | East Asian monochrome ink painting | unlit | value | high | exponential `Fog` as mist, tapered 5-sided forms |
| Bauhaus Block | primary colour, elementary solids | unlit | category | high | 16-sided prisms, `OrthoViewpoint`, baked relief only |
| Terracotta | sun-baked earthen city | phong | value | mid | low sun, shadows, stepped tapered forms |
| Brass Orrery | instrument brass on velvet | physical | value | low | `PhysicalMaterial`, tube links, ring grid, spike caps |
| Atlas | printed school atlas | phong | value | high | ink edges, ring grid, serif labels |
| Viridis Lab | the scientific figure | phong | value | high | perceptually uniform ramp, neutral field, ortho |
| Illuminated Manuscript | medieval Armenian miniature | phong | category | high | 8-sided spired forms, gold tube links, ink edges |
| Thermal | infrared false colour | unlit | value | low | glow alert, exponential `Fog` |
| Risograph | two-drum stencil print | unlit | category | high | 6-sided prisms, flat ink, ortho |

All twelve worlds: XSD 4.0 valid, 0 semantic errors, 0 warnings (x3d_mcp fork 4d433af). **C**
All twelve drawn in X_ITE 16.7.1, Chromium 157 under Playwright, SwiftShader WebGL2; frames in the Demo 75 folder with `shots-receipt.json`. **C** for "draws and is not black"; no hardware GPU was used.

## 6. What the grammar found

**In the authored styles (before any repair): 4 of 12 failed.** **C** (`out/build-receipt.json`)

| style | failed | measured | repair moved | drift (Delta E OK) mean / max |
|---|---|---|---|---|
| Neon Noir | G4: two categories merge for deutan readers (`#6fb7e0` blue, `#c58ce0` violet) | 0.020, need 0.04 | 2 of 22 colours | 0.0011 / 0.0126 |
| Ink Wash | G3: the lightest ink sinks into the paper | 0.059, need 0.10 | 1 of 20 | 0.0025 / 0.0502 |
| Bauhaus Block | G3 cream block on cream plate; G4 grey and green merge for protan | 0.074; 0.021 | 3 of 20 | 0.0099 / 0.1723 |
| Risograph | G4: fluorescent pink and medium blue merge for protan readers | 0.024, need 0.04 | 4 of 20 | 0.0043 / 0.0376 |

Two more were caught while tuning and are kept as tests: the classic hypsometric atlas ramp (green, yellow, brown) fails G5 because its lightness reverses (span 0.048), and the first Atlas repair moved one stop by 0.37, which is a rewrite, not a repair. The catalogue's Atlas ramp was re-authored instead.

The incumbent look failed its own first check. The fix was two colours moved by about one just-noticeable difference.

**Across the whole space: 12 structures × 12 palettes × {as is, inverted} = 288 sentences.** **C** (`out/matrix.json`, Node 22 lint)

| set | sentences | valid as is | valid after repair |
|---|---|---|---|
| each style in its own palette | 12 | 12 (100%) | 12 |
| transposed, as is | 144 | 71 (49%) | 98 (68%) |
| inverted | 144 | 33 (23%) | 60 (42%) |
| all | 288 | 104 (36%) | 158 (55%) |

Reading: palettes are not freely portable. The commonest failures are G6 (79: the donor's alert colour is too close to a body colour of the new structure), G3 (76: bodies sink into the plate) and G4 (68: a palette authored for a ramp has weak categories). `repair` only moves lightness and does not yet address G6, G8 or G14, which is why 130 sentences stay invalid. That gap is the open target for a learned optimizer (section 8).

## 7. Findings about X3D and X_ITE made on the way

| # | finding | grade | evidence |
|---|---|---|---|
| F1 | **Albedo-true exposure.** If key, fill and ambient are scaled so an unshadowed up-facing surface receives exactly 1.0, a Phong ground is drawn at exactly its palette colour and meets the `Background` at the horizon with no seam. | C | pixel at (60, 650) of the Manuscript, Atlas and Brass frames equals `palette.ground` to the byte (`#f1e3c2`, `#cfe3ea`, `#12100c`); X_ITE 16.7.1, SwiftShader |
| F2 | X_ITE reads `Color` under `PhysicalMaterial` as linear light and under `Material` / `UnlitMaterial` as sRGB. A style that switches `surface.model` must convert, or the same hex draws differently. | L | inferred from frames before and after converting; no isolated two-patch test was run |
| F3 | Under `PhysicalMaterial`, `Fog.color` behaved as linear too: a dark brown haze `#1a140c` drew as light olive and washed the scene. The Brass style ships with fog off. | S | one scene, one frame pair |
| F4 | An exact top-down `Viewpoint` (camera straight above, up = −Z) came out turned 180° in X_ITE's examine viewer; tilting the camera 3° off the nadir cured it. | L | two frame pairs (Blueprint, Atlas) |
| F5 | `PhysicalMaterial` without an environment light draws metals darker than their base colour. `EnvironmentLight` is X3D 4.1, so a 4.0 style cannot ask for it. | L | Brass frame; no 4.1 comparison run |
| F6 | `DirectionalLight shadows='true'` with `shadowIntensity` works in X_ITE under SwiftShader and gives the Maquette and Terracotta looks their depth. | C | frames |
| F7 | Metadata on `WorldInfo` does not survive the Loom glTF lane (documented there); the style `MetadataSet` therefore rides on the root `Group`. After that move the round trip is lossless. | C | `gltf-receipt.json`: 12 of 12 worlds pass S0..S6, 732 Metadata nodes |
| F8 | A `.` in a Metadata name draws a validator warning (it clashes with ClassicVRML ROUTE syntax). Token names in the file use `_`: `xst:palette_ground`. The same string is the RDF property name. | C | 49 warnings per file before, 0 after (x3d_mcp fork 4d433af) |
| F9 | **The frame corrected the grammar.** Inverting the Paper Maquette gave black card on a black ground. The linter passed it 10 of 10, because G3 let shading stand in for colour; the frame's mean luminance was 0.011, flagged BLACK. G3 now lets shading carry only a light body (L ≥ 0.5). 22 more of the 288 sentences fail as a result, correctly. | C | first frame run, `op-invert-maquette`; test "the black-frame case" |

## 8. The evals socket (DSPy-ready, switched off)

One metric, one task set, three baselines that need no model. Nothing was optimized and nothing was spent.

- **Tasks** (`node bin/eval.mjs tasks`): 184 *repair* tasks (every invalid sentence of the 288: return a valid style that stays close) and 12 *author* tasks (a brief in words: return a full style). Split by FNV-1a hash of the task id: 97 + 6 train, 87 + 6 dev.
- **Metric** (`node bin/eval.mjs score <task-id> < style.json`): `0.5 × grammar` if any rule fails; otherwise `0.5 + 0.5 × fidelity × brief`. Fidelity is `1 − mean Delta E OK from the input palette / 0.12`. Brief is 1 when the structure is untouched (repair) or the share of requested key, hue encoding and surface model that match (author).
- **Baselines on dev (n = 87)**: **C**

| candidate | score | grammar | fidelity | valid |
|---|---|---|---|---|
| identity (do nothing) | 0.432 | 0.865 | 1.000 | 0 |
| home-palette (throw the palette away) | 0.501 | 1.000 | 0.002 | 87 |
| `repair` (deterministic lightness hill-climb) | 0.646 | 0.921 | 0.968 | 33 |
| a perfect optimizer | 1.000 | 1.000 | 1.000 | 87 |

The first version of the metric was additive (`0.6 × grammar + 0.3 × fidelity + 0.1 × brief`) and the cheat won: home-palette 0.70, repair 0.67 (dev, on the task set as it then stood). The metric was changed before any optimizer saw it. A metric is a witness and gets suspected first (law 26).

- **DSPy seam** (`evals/dspy_socket.py`): `load_tasks`, `score`, a `metric(example, pred, trace, pred_name, pred_trace)` that returns a float for MIPROv2 and score plus feedback text (the failing rules with measured values) for GEPA, and a `StyleFromBrief` signature. It imports `dspy` only when `XST_DSPY=1`, and stops before any call if no model is configured. Not run: **nothing here is evidence that a learned optimizer helps.**

## 9. Ontology

| file | what | size |
|---|---|---|
| `vocab/xst.context.jsonld` | JSON-LD 1.1 context: a style document is RDF as written | 75 terms |
| `vocab/xst.ttl` | OWL classes (Style, the 10 parts, Scene, Rule, Operator), 48 token properties, SKOS schemes for roles and rules, `xst:realizedBy` links to the X3D Ontology 4.0 node classes | 555 triples |
| `vocab/xst.shapes.ttl` | SHACL: one of each part, every token present, hex patterns, enumerations, ranges | 455 triples |

All three are **generated from the grammar** (`bin/vocab.mjs`), so the ontology cannot drift from the code.

Namespace: `https://hagopjay.github.io/x3d.loom/ns/style#` (prefix `xst`). It reuses, without redefining: SKOS (concept schemes), PROV-O (`wasDerivedFrom`, operators as activities), Dublin Core terms, and the X3D Ontology (`https://www.web3d.org/specifications/X3dOntology4.0#`) as the target of `xst:realizedBy`.

Checks, rdflib 7.6.0 and pyshacl 0.40.2: **C**
- catalogue → 1,124 triples; conforms to the shapes;
- 6 of 6 deliberately broken styles rejected (missing part, bad colour, unknown word, out of range, bad colour inside a list, no declared key);
- **X3D round trip**: for 12 of 12 worlds, the 48 tokens read back from the file's `MetadataSet` equal the catalogue's, value for value;
- **glTF round trip**: 12 of 12 worlds pass S0..S6 through `KHR_xmp_json_ld` and back (Loom glTF lane, `x3dsem 0.1.0`), 61 Metadata nodes each.

One name, three places: `xst:palette_ground` is the JSON-LD property, the RDF predicate and the X3D `MetadataString` name.

How another ontology plugs in: a domain ontology says *what a thing is* (a CIDOC-CRM `E22`, an IFC wall); this vocabulary says *what role it plays in a picture* (`xst:role "mass"`) and *how roles look*. The two meet on the X3D node: its domain reference and its `xst:role` sit side by side in Metadata. A mapping file `domain class → xst role` is the only glue needed, and it is data.

## 10. Use

```sh
cd x3d.style
python3 tools/build_scene.py                 # data/node-city.scene.json   (needs x3d.py)
node bin/build.mjs                           # lint, repair, compile 12 worlds, the 288 matrix -> out/
python3 tools/validate.py ../../x3d_mcp out  # XSD 4.0 + semantic
node bin/vocab.mjs && python3 tools/check_rdf.py && python3 tools/gltf_roundtrip.py
node bin/eval.mjs baselines out/evals-receipt.json
node --test tests/style.test.mjs             # 11 tests
```

```js
import { lint, transpose, invert, mixStyles } from './src/grammar.mjs';
import { repair } from './src/repair.mjs';
import { compile } from './src/compile.mjs';
const world = compile(scene, repair(invert(transpose(neon, manuscript)), scene).style);   // X3D 4.0 text
```

The kit has no dependencies and runs unchanged in Node 22 and in the browser; Demo 75 compiles every world live in the page (39 to 231 ms per world on the build machine in the last build, 0.54 to 2.79 MB of X3D each).

## 11. Tested, and not

Tested here: lint, operators, compile, XSD and semantic validation, RDF and SHACL, X3D and glTF metadata round trips, frames in X_ITE 16.7.1 under SwiftShader, three model-free baselines, 11 unit tests.

Not tested: a hardware GPU; any engine other than X_ITE (three.js, Babylon, Castle, Blender import, x3d.wgpu); rendering the glTF output; readers with colour-vision deficiency; a second scene (the compiler is written against roles, but only the node city has been through it); `PixelTexture` patterns, `FillProperties` hatching and custom shaders, which the vocabulary does not yet speak; any learned optimizer.

## 12. Next, in order of value

1. **A second scene** (a graph, a terrain) through the same 12 styles. This is the real test of "abstract".
2. **Restyle an existing demo**: tag Demo 74's groups with `xst:role` and bind a style to a world the kit did not build.
3. **Teach `repair` G6, G8 and G14**, or switch the DSPy socket on and let an optimizer try: 130 sentences are waiting.
4. **Pattern and texture as an eleventh part of speech** (hatch, halftone, paper grain).
5. **A second renderer row** in the receipt (three.js or Babylon bridge) to see which tokens survive which engine.
