# Resonance Loom: geometry, display and musical time

This fold-back applies the repository's existing [science playbook](../../SCIENCE-PLAYBOOK.md), [Math Lab lessons](../../LEARNINGS-mathlab.md) and [Loom definition](../../LOOM-v1.md) to a native X3D audiovisual instrument. It records reusable design decisions and their controls. Fresh executed outcomes belong in [VALIDATION.md](VALIDATION.md); this note does not mint a formal Loom profile or acceptance receipt.

## 1. Define the figure before enhancing its appearance

**Problem:** A radial shader can look like a Sri Yantra while carrying none of its incidence constraints. A familiar silhouette alone cannot establish the requested construction.

**Implementation:** A 100-digit Decimal builder selects a concentric member of the Huet/Chiodo concurrent family. Its output is canonical coordinate data, named triangles, active chamber vertices, even-coverage voids and a numerical certificate. Native X3D ornament is built around that fixed figure.

**Control:** Measure the common circumcircle, seven apex/base incidences, bilateral triple intersections, reflection symmetry and central incenter offset. A symmetric width perturbation must fail concurrency even if the result remains attractive.

**Carry upstream:** Store a claim's mathematical referent as data before making a rendering of it. State the family, normalization and additional selection conditions; a chosen root is not a proof of uniqueness.

## 2. A count needs an inclusion rule and a shape test

**Problem:** “Forty-three triangles” is ambiguous. This arrangement has 74 bounded cells and 53 triangular cells in total. Forty-three appears only after the intended inclusion rule is specified.

**Implementation:** The independent finite-segment auditor splits 27 edges at intersections, constructs a planar graph and walks its bounded faces. Odd coverage by the nine maximal triangles selects 43 active chambers, with rings 1 / 8 / 10 / 10 / 14. The other 31 bounded cells have even coverage: 10 triangles and 21 quadrilaterals. Euler's identity checks 142 − 69 + 1 = 74.

**Control:** Keep simple known arrangements beside the complete construction. Perturbations must test triangular shape and line incidences as well as the count: a symmetric width fault can retain 43 odd-covered cells while turning some into nontriangular regions.

**Carry upstream:** A witness should recover a claimed structure without stopping when the expected count is reached. Retain rejected and inactive cells so the inclusion boundary remains inspectable.

## 3. Precision is a chain of representations

**Problem:** “100-digit geometry” can be misread as “100-digit pixels.” JavaScript number storage, native coordinate fields, GPU transforms and raster coverage have different properties.

**Implementation:** The certificate distinguishes Decimal construction, exported binary64 coordinates and binary32 quantization. Declared constraint bounds are 10⁻¹² R for binary64 and 10⁻⁷ R for binary32/native-field checks. The recorded binary32 concurrency residual is approximately 1.84×10⁻⁸ R. Source and native checks share named constraints but do not share an unjustified tolerance.

**Control:** Extract the serialized canonical coordinate field and audit it; separately quantize with `Math.fround`. The application also audits the actual native `YantraCoordinates.point` field after scene creation. Coordinate hashes identify retained bytes; bounded numerical comparisons describe representation error.

**Carry upstream:** Name the representation alongside every precision claim. A sharp screenshot is a visibility witness, not a substitute for measured coordinate residuals or an interval proof.

## 4. Preserve invariants while giving the surrounding world freedom

**Problem:** Independent vertex wobble looks alive but destroys the very concurrency being claimed.

**Implementation:** Both yantra layers reuse one canonical geometry. Animation changes color, emissive response, opacity, depth and whole-layer translation, rotation and uniform scale. Lotus rings, filigree and other ornament are separate authored geometry. Detail settings vary ornamental tessellation without changing the canonical coordinates.

**Control:** Scene tests deny access to the canonical coordinate node during animation, check uniform scale, and compare high/balanced coordinate serialization. Layer visibility and zero-opacity controls cover the aura/fill materials as well as the main line.

**Carry upstream:** Write the allowed transformation group into the rendering contract. For incidence geometry, whole-figure similarities preserve the intended relationships; local deformations require a different claim.

## 5. Circular quantities need circular statistics

**Problem:** Ordinary phase variance treats values near opposite ends of a phase interval as far apart even when they nearly coincide around a circle.

**Implementation:** The decorative field computes coherence as the magnitude of the average complex unit vector: |Σ exp(iφⱼ)/N|. The field has 64 authored oscillators and explicit controls; it is synthetic rather than a sensor for human or network activity.

**Control:** Phases just below 2π and just above zero must be coherent. Global phase rotation must leave coherence unchanged. Four evenly spaced phases must cancel.

**Carry upstream:** Respect a quantity's domain before choosing an aggregate. A mathematically appropriate statistic still does not establish the source or meaning of its inputs.

## 6. Audio and animation need one transport owner

**Problem:** Frame-count animation and an independently advancing audio scheduler drift, change behavior with refresh rate, or release a backlog after a pause.

**Implementation:** `PulseTransport` owns elapsed time and musical beat. Tempo changes anchor the current position before changing future beat rate. Sound activation hands the transport to the audio clock without jumping phase; muting returns it to the performance clock. Pause freezes both time and beat. Backgrounding pauses explicitly. Bounded lookahead schedules future notes and skips late events; disposal owns voice and timer cleanup.

**Control:** Deterministic clock adapters test tempo changes, pause/resume, reset, clock handover, muting, bounded scheduling and disposal. Real browser sound needs separate observation; Web Audio-shaped adapters establish event logic rather than audibility or audio-device behavior.

**Carry upstream:** The transport owns phase; display and sound consume it. Define mute, pause, background and disposal separately before adding effects.

## 7. A native scene and its external services have distinct exports

**Problem:** Exporting an X3D image plane does not make a shader-painted mandala native geometry, and exporting a scene does not preserve an external audio graph.

**Implementation:** Named X3D coordinates, ribbons, fills, points, materials, switches and transforms represent the artwork directly. The X3D snapshot carries geometry and appearance. The score JSON carries authored settings and transport position. The numerical certificate carries mathematical claims and coordinate identity. Web Audio and the browser controller remain external runtime services.

**Control:** Native scene generation tests reject script, external scene, image-texture and custom-shader substitutions in this app's declared geometry path. Export and native-reader observations are recorded separately from source tests.

The pinned native runtime also changes the serialization envelope: the authored scene declares X3D 4.0, whereas its live XML snapshot declares 4.1. Validate the declared export version against its own pinned schema. The same serializer underdeclares Shape level 4 for this PointProperties scene; a narrow export adapter preserves the required level 5 without editing the scene payload. This was found by the actual semantic validator, and the corrected snapshot is checked again. A known fixed Web3D DOCTYPE can be handled without enabling arbitrary DTDs, entities or network resolution.

**Carry upstream:** Give each export a precise promise. A static scene, a settings document, a recorded performance and an executable checkpoint are different artifacts.

## 8. Offline packaging is an adapter with a declared boundary

**Problem:** A local runtime can still request fonts, CSS, Wasm or images by URLs derived from its own script location. Inlining only its JavaScript is insufficient for a reliable standalone.

**Implementation:** The build verifies a pinned X_ITE 16.8.0 inventory, embeds the retained asset closure and applies narrowly checked resource-URL/CSS-integrity adaptations to a derived runtime. Original vendor bytes remain intact. The adapter report records both runtime hashes, each substituted expression and asset/module counts.

**Control:** Embed source code with replacement callbacks so literal dollar sequences cannot expand as replacement-string syntax; require exact presence of the adapted runtime in the result. Every replacement must match the pinned runtime exactly once; missing assets and runtime hash drift fail the build. Browser request observation, local-file behavior and external X3D reading remain separate integration checks.

**Carry upstream:** Package dependency behavior, not just the top-level file. Preserve attribution and make derived adapters reconstructible from pinned source.

## Evidence and scope

The [attachment review](ATTACHMENT-REVIEW.md) distinguishes the supplied design conversation from implemented behavior. [GEOMETRY.md](GEOMETRY.md) defines the mathematical construction and sources. The [field guide](FIELD-GUIDE.html) explains controls and interpretation. [VALIDATION.md](VALIDATION.md) is the place for actual commands, outcomes and host limitations. Neither authored harmony nor the 108 Hz fundamental implies a therapeutic effect; neither this fold-back nor a passing local test suite establishes repository-wide Loom certification.
