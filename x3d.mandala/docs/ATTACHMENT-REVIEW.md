# What was in Babylon.mandala.md

The supplied 2,054-line Markdown file is a saved design conversation followed
by a Babylon.js/Vite/TypeScript starter scaffold. It proposes a local synthetic
network whose energy, coherence, tension and latency-like values modulate a
glowing radial mandala. It is not an existing Sri Yantra construction or an
audio implementation.

The first part compares Babylon.js with Cytoscape.js, outlines a simulation →
aggregation → visual synthesis → rendering pipeline, and gives conceptual
snippets. The second part presents named source-file blocks: package/build
configuration, types, seeded RNG, color palettes, `PeerField`,
`StateSynthesizer`, GLSL shaders, a quality manager, screenshot/share utility,
HUD, visual experience and application entry point. A project would have to
be assembled from the appropriate blocks rather than running this Markdown
file. The conceptual snippets and later classes are alternatives, with some
different method signatures.

## What is worth carrying forward

| Idea in the attachment | Use in Resonance Loom |
|---|---|
| Separate simulation, aggregate state and rendering | A pure synthetic field feeds X3D field updates and audio texture without owning the canonical geometry. |
| Seeded procedural state | The decorative field is reproducible rather than depending on network services or random changes each frame. |
| Concentric petal, ring and filament composition | Native X3D paths, triangle ribbons, fills, points and named transforms express the ornament. |
| Energy/coherence/tension as visual controls | An explicitly synthetic oscillator-coherence control modulates an authored composition. It does not measure a crowd or emotional state. |
| Palette families and one-click resonance | Four color families and a shared-phase resonance accent provide a small, legible instrument. |
| Export and quality controls | Native X3D snapshot, score/settings and numerical certificate exports preserve distinct kinds of evidence. Two desktop detail levels vary sampled ornament. |

The attachment's strongest contribution is this separation of concerns and
its visual direction. Neither requires retaining Babylon.js, a backend, or a
shader-defined mandala.

## Gaps and repair decisions

**The sacred geometry was unspecified.** The fragment shader creates petal
and ring masks using polar functions, noise and distortion. Its screen image
can be attractive, but there are no nine canonical triangles, published
concurrency equations, independently recovered chambers or numerical error
certificate. It cannot establish a mathematically concurrent Sri Yantra.
The new construction is generated and audited separately, and its canonical
coordinates remain locked during animation.

**Most of the mandala was painted onto one plane.** Although the scaffold adds
torus meshes, a knot and orbiters, the main radial image is a fragment-shader
effect. That conflicts with this task's requirement that the geometry remain
X3D. The replacement uses a native X3D scene graph and X_ITE; it does not hide
an SVG, shader-painted image or Babylon scene behind an X3D export label.
The halo ribbons and sampled petals are deliberately identified as artistic
display geometry, separate from the audited triangle centerlines.

**The phase statistic was linear.** The proposed summary averages phase
values on the interval [0,1] and computes ordinary variance. Phases 0.99 and
0.01 would look widely separated even though they nearly coincide around a
circle. The replacement uses the magnitude of the mean complex unit vector.
This fixes a mathematical aggregation boundary; it does not turn synthetic
oscillators into observations of people.

**Some evolution depended on frame count.** Cluster mood changes include
small per-frame terms without multiplying by elapsed time. The same initial
state can therefore evolve differently at different display refresh rates.
Elsewhere the scaffold changes a shader seed with the visual clock, which
can introduce unwanted temporal noise. The new decorative field is sampled
from a stable definition and musical beat position; tempo changes preserve
phase, and both sound and animation read one transport.

**Petal count was a floating visual parameter.** A noninteger angular petal
frequency can create a seam at the polar branch cut. It also has no connection
to the required forty-three chambers. The replacement explicitly builds the
eight- and sixteen-petal rings and an authored outer ornamental ring, while
the central triangular arrangement has its own audited topology.

**Audio and shared timing were absent.** There is no Web Audio graph, musical
scheduler or sound-permission flow in the attachment. The new instrument
creates audio only after a user gesture. A shared transport drives visual
beats and a bounded-lookahead harmonic score; late events are skipped instead
of replayed in a backlog. Muting, pausing, backgrounding and disposal have
distinct behavior. The pitch options are musical choices, with no therapeutic
claim attached.

**Reduced motion only selected a lower quality tier.** Lower resolution or
particle count does not remove the motion or glitch effects that may be
uncomfortable. Stillness mode now holds geometric layer motion while retaining
gentle color and optional sound; the operating-system preference initializes
that choice. Pause provides a separate whole-transport stop.

**Production boundaries were incomplete.** The starter uses loose dependency
ranges, assumes positive peer/cluster counts, does not define a complete pause
and background lifecycle, and includes a camera-control type assertion that
disguises `false` as an HTML element. That binding is version-dependent and
unverified rather than a reliable integration contract. The document supplies
no executed test evidence, disposal contract, mathematical proof or browser
compatibility record. These are reasonable gaps in a starter, but should not
be promoted into production claims merely because its code blocks are long.

## What this translation intentionally keeps separate

1. **Canonical mathematics:** the selected concentric member of the Huet/Chiodo
   family, explicit incidence constraints, independently reconstructed active
   chambers, precision bounds and coordinate identity.
2. **Native scene representation:** X3D geometry, materials, switches and
   whole-layer similarity transforms. Foreground and background share canonical
   coordinates through `DEF/USE`.
3. **Authored instrument:** palettes, ornament, pulse depth, oscillator behavior,
   pitch relationships and the musical score.
4. **Runtime services:** X_ITE display, JavaScript transport, Web Audio sound,
   UI and exports. A static X3D snapshot does not automatically carry the live
   audio graph into every X3D viewer.

The attached Markdown remains unchanged. Its ideas inform the new work; its
claims and illustrative snippets are not treated as validation evidence.
Read `FIELD-GUIDE.html`, the construction notes and the separate validation
record for the implemented behavior and actual executed checks.
