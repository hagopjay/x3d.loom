# What the Sri Yantra instrument carries back

The [Resonance Loom application](x3d.mandala/) turns the supplied radial-mandala design into native X3D geometry with an independently reconstructed Sri Yantra, shared audiovisual time and explicit export boundaries. These are implementation lessons linked to the existing [science playbook](SCIENCE-PLAYBOOK.md) and [Math Lab learnings](LEARNINGS-mathlab.md). Fresh test outcomes and host limits belong in the application's [validation record](x3d.mandala/docs/VALIDATION.md); this note does not assert a formal Loom acceptance.

| Lesson | Concrete boundary | Reusable rule |
|---|---|---|
| Define the figure before rendering it | A selected concentric Huet/Chiodo-family member has published incidence constraints, canonical data and a certificate. | State the family and selection; a precise chosen shape is not a unique universal shape. |
| Count by meaning, then recover topology | 43 odd-coverage triangular chambers coexist with 31 even-coverage voids; the full arrangement has 74 bounded cells. | An expected count needs an inclusion rule, an independent enumeration and a shape control that can fail. |
| Audit the representation you actually use | Binary64 constraints use a 10⁻¹² R bound; binary32/native-field checks use 10⁻⁷ R, with recorded quantization residual about 1.84×10⁻⁸ R. | Separate arithmetic, serialized coordinates, native fields and pixels. A source certificate does not automatically certify the display chain. |
| Animate inside the claim's invariants | Canonical coordinates remain fixed; complete layers use similarities while ornament and appearance vary. | Declare the allowed transformation group and keep deformation outside the measured referent. |
| Aggregate on the right domain | Synthetic phase coherence uses the complex unit-circle order parameter. | Correct circular statistics repair a mathematical boundary without turning authored inputs into observations. |
| Give musical phase one owner | One transport handles tempo changes, audio-clock handover, mute and pause. | Sound and animation consume shared state; adapters test scheduling while native browser observations test actual output. |
| Export distinct promises | X3D scene, score/settings JSON and numerical certificate carry different information. | A snapshot is not a recording, portable live audio graph or resumable checkpoint. |
| Make standalone packaging inspectable | A hashed X_ITE 16.8.0 source inventory feeds a bounded resource-URL adapter and embedded assets. | Preserve original vendor bytes, record derived changes and verify runtime requests separately. |

The detailed mechanisms, counterexamples and control locations are in [x3d.mandala/docs/FOLDBACK.md](x3d.mandala/docs/FOLDBACK.md). The construction and primary mathematical references are in [GEOMETRY.md](x3d.mandala/docs/GEOMETRY.md). The original attachment is reviewed in [ATTACHMENT-REVIEW.md](x3d.mandala/docs/ATTACHMENT-REVIEW.md). These extend the Loom's existing separation of claims, witnesses and display; they do not introduce a new repository-wide certification profile.

## Edition 2.0 · what the Chamber Harp adds (18 Nov 2026)

| Lesson | Concrete boundary | Reusable rule |
|---|---|---|
| Make the invariant playable | 43 chamber lights, 9 triangle lights and 60 sparks animate only materials and transforms; the browser gate compares the live `YantraCoordinates` before and after every click. | When a figure is measured, add interaction as new appearance nodes beside it. Re-check the measured field after interaction, not only at load. |
| One sensor plus a pure locator | A single `TouchSensor` reports hits in the layer's local units. `locate()` resolves chambers by point-in-triangle, and all 43 independent interior samples land in their own chamber. | Keep picking geometry-agnostic and test the locator against independent data. An invisible plate makes gaps pickable so the UI can explain them. |
| Teach with every touch | A strike lights the triangles that cover it (9 for the bindu, 1 for the outer ring). A gap reports its even coverage. | Map interaction to the claim's own vocabulary (coverage depth, odd/even), so playing is also reading the witness. |
| Let symmetry pick the tuning | 26 bilateral classes share pitches, rising toward the bindu. | Derive sonification from the figure's structure, and label it as authored. |
| Deterministic time-driven light | The spiral light is a pure function of the musical beat; the spark poses are closed-form in time. | Pure functions of the shared clock are testable without a browser and survive tempo changes and pauses. |
| Post effects need a governor | X_ITE 16.8.0 has no bloom. A 2D-canvas copy of the frame costs 7.2 → 3.0 fps on SwiftShader. Bloom starts off on software GL and switches itself off above a 30 ms median frame. | Detect the renderer, measure, and switch off. Log the cost on real GPUs as an open receipt. |
| Check the runtime bundle before choosing a node | The ParticleSystem component loads lazily from a file the vendored runtime does not include. It 404'd in the browser, so the sparks became a transform pool. | Probe the pinned runtime for the component, not the spec. Lazy components need vendoring and adapter edits for an offline standalone. |
| Name the receipts by edition | 1.0 receipts stay in git history; 2.0 writes `harp-browser-2.0.json` beside the refreshed upstream witnesses. | Never overwrite a frozen release; a new edition gets new receipts and a new frozen path. |

Detail: [x3d.mandala/docs/CHAMBER-HARP.md](x3d.mandala/docs/CHAMBER-HARP.md), gaps: [HARP-GAPS.md](x3d.mandala/docs/HARP-GAPS.md).
