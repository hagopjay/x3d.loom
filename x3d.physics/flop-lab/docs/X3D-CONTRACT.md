# Flop Lab X3D bridge contract

`toX3D(level)` and `fromX3D(text)` implement **`floplab-x3d-slice/1`**.
This is the application's explicit 2.5D level mapping, not a general X3D
loader, XSD validator, full RigidBodyPhysics engine or physics-conformance test.
Actual pinned `x3d_mcp` schema and implemented semantic checks are separate.

## What X3D contributes

Bodies, geometry references, hinge structure and region placement remain
readable and addressable in a standard X3D 4.0 document. DEF/USE links connect
the displayed geometry with its body record. The file can be inspected by
standard tooling, and the application can explain which body and prefab a
selected object came from. The custom solver stays behind a declared adapter.

The bridge uses X3D RigidBody, CollidableShape, SingleAxisHingeJoint,
BallJoint and ProximitySensor structures. Its `flop` metadata supplies the
extra application semantics. In particular:

- The solver moves in XY with Z-axis rotations; it is not a full 3D solver.
- An exported Cylinder is the display representation of a 2D sampled pill.
  Its collision/inertia approximation is not native 3D cylinder dynamics.
- A BallJoint plus metadata represents the app's spring or unilateral rope.
  A different X3D engine is not promised equivalent spring behavior.
- A ProximitySensor plus metadata represents a gameplay region. The app's
  region logic is separate from native browser proximity behavior.
- Camera, navigation, background and material appearance are presentation
  owned by the page and its role palette. Importing an arbitrary camera or
  material does not replace that page view.

`fromX3D()` returns `level.importReport` with this scope and the approximations.
Do not reduce that report to a universal green “X3D valid” badge.

## Admission before mutation

`validateLevel(level)` returns `{valid: true, stats}` or throws an Error whose
message begins with a stable `X3D_*` category. `getLevelStats(level)` returns
body/joint/region/part counts, shape counts and **body-centre** bounds; those
bounds are not geometry extents, collision bounds or a motion envelope.

`validatePart(kind, params)` validates a supported prefab's known parameters
before expansion, including count/size constraints. The returned object is
the parameters merged with prefab defaults. Validate an edited candidate
copy before replacing the live level. A half-applied mutation is not an
accepted candidate.

| Bound | Application value |
|---|---:|
| XML source | 2 MiB UTF-8 |
| Bodies / joints | 900 / 2,400 |
| Regions / prefab records | 512 / 250 |
| Body/anchor coordinates | −10,000 through +10,000 m |
| Body dimensions / sphere radius | 0.001–1,000 m / 0.001–100 m |
| Gravity magnitude | 0–80 m/s² |
| Substeps / solver iterations | integer 1–24 / 1–6 |
| A sampled pill's collision circles | at most 128 |
| One water region's columns | at most 1,024 |

These bounds limit source interpretation and predictable allocations. They
are not frame-time, solver-stability or physical-accuracy guarantees. Extreme
but admitted combinations still need measured numerical/runtime investigation.

## Supported import slice

The importer accepts one X3D 4.0 Scene containing exactly one
RigidBodyCollection, the exporter’s supported geometry/metadata structures,
and world presentation declarations. Unsupported nodes and attributes fail
with `X3D_UNSUPPORTED_NODE` or `X3D_UNSUPPORTED_FIELD`, rather than being
silently interpreted as a supported feature.

All DEF identifiers are unique across the document. USE must name an earlier
same-type DEF without field overrides. Local IDs use a bounded ASCII subset;
that is an application rule, not the full X3D naming language. Body IDs must
also avoid collisions with generated `C_` visual IDs and reserved world names.
Joint endpoints must exist and be distinct. Geometry and body positions must
remain planar; unsupported orientation axes, arbitrary Box depth and region
depth are refused rather than projected silently.

Numeric vectors have exact cardinality and finite components. Geometry sizes,
mass, material/field parameters, joint limits, kinematic settings and region
allocations receive their own checks. A numeric typo is not a default value.
Unknown application fields cannot disappear during export. Metadata keys that
could alter an object prototype, repeated keys and malformed MFString tokens
are refused. Quotes and backslashes in supported text survive serialization.

An XML declaration and the exporter's exact fixed X3D DOCTYPE are permitted.
Alternate DTDs, internal entity subsets, entity declarations, CDATA and other
processing instructions are refused. Scripts, Inline URLs, textures, PROTOs,
arbitrary Transform hierarchies and external assets are outside this bridge
slice. The XML DOM is interpreted as data; it is not inserted into the page.

The canonical default level still exports byte for byte identically. Small
values retain significant digits: a compliance of `1e-5` does not become zero.
That precision policy is a serialization choice, not an assertion of arbitrary
floating-point bit preservation. Every imported valid document is normalized
to this bridge’s own export representation.

## Controls

Run `node test/x3dio.test.mjs` for the pure-data and codec controls. It tests
the positive default alongside single-fault specimens: dimensions, nonfinite
values, global/reference conflicts, allocation expansion, prefab changes,
metadata escapes, fixed-DTD policy and precision. Native DOM parsing,
round-trip browser behavior and actual XSD/semantic validation are separate
checks. A missing parser or validator must never count as a caught defect.
