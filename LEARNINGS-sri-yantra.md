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
