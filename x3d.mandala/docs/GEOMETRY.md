# A measured, concentric Sri Yantra

This instrument uses one explicitly selected member of the concurrent planar
Sri Yantra family studied by Gérard Huet and Alessandro Chiodo. The construction
is not uniquely determined by the usual concurrency conditions. “Perfect” here
means satisfying a published constraint set within declared numerical bounds,
with an independently reconstructed chamber arrangement. It does not mean a
universal historical set of sacred measurements has been discovered.

## Definition and selection

Chiodo orders the nine isosceles triangles by base height from top to bottom.
T1–T5 point down; T6–T9 point up. His conditions (i)–(iii) require that T3 and T7
share a circumcircle; seven apices coincide with another triangle's base
midpoint; and twelve leg/base/leg incidences hold on each side of the reflection
axis. Those twelve bilateral incidences yield 24 off-axis triple intersections.

Huet's line construction begins in a unit-diameter frame: bottom O=(0,0), top
T=(0,1), outer circle x²+(y−½)²=¼. It uses five real parameters and one remaining
concurrency equation. The concurrent family therefore has four degrees of
freedom. Our additional selection requires the incenter of the central triangle
to coincide with the circumcircle center. This leaves three degrees of freedom;
we fix XF=0.126, XA=0.187 and YJ=0.398, then solve the closure and concentricity
equations for YQ and YP.

| Parameter in Huet's diameter frame | Selected value |
|---|---:|
| XF | 0.126 |
| XA | 0.187 |
| YJ | 0.398 |
| YQ | 0.6483805394503203479815604331828611374634751988733 |
| YP | 0.4392613844381596570894559885454988286303786009414 |

The builder uses 100-digit Decimal arithmetic and Newton iteration on these
two constraints. Construction points are line intersections and circle
intersections, rather than rounded pixel measurements. Output is normalized
by (x,y) ↦ (2x,2y−1), giving circumradius R=1 and bindu/incenter (0,0).
Central-triangle equilateralness and congruence of the two largest triangles
are not imposed: these are extra conditions found in some mathematical
variants, not requirements of the selected Huet/Chiodo family.

## What the forty-three chambers count

An independent finite-segment arrangement splits the 27 triangle edges at all
intersections, builds a directed planar graph, walks its faces, removes
collinear subdivision vertices, and tests face coverage by the nine triangles.
It does not stop when it finds forty-three items.

The complete arrangement contains 69 vertices, 142 edges, one connected
component and 74 bounded cells. Euler's formula checks 142−69+1=74. Of those
cells, **43 triangular chambers have odd coverage**: they lie inside 1, 3, 5, 7
or 9 of the nine maximal triangles. From the center outward their counts are
1, 8, 10, 10 and 14. This is the conventional chamber structure.

There are also **31 even-coverage voids**: ten triangular and twenty-one
quadrilateral cells. Counting every triangular bounded cell would yield 53 and
would misdescribe the traditional forty-three. The data and certificate retain
both the full arrangement and the active/void classification.

| Active coverage depth | Ring from center | Count |
|---:|---:|---:|
| 9 | 0 | 1 |
| 7 | 1 | 8 |
| 5 | 2 | 10 |
| 3 | 3 | 10 |
| 1 | 4 | 14 |

## Precision is a layered claim

The generated certificate measures distances in units of the circumradius.
It records the residual of each triple intersection, every apex/base incidence,
the two common-circumcircle triangles, reflection symmetry, and the central
incenter offset. It also includes the canonical coordinate-data SHA-256.

| Representation | Measured maximum concurrency residual |
|---|---:|
| 100-digit Decimal construction | about 1.7×10⁻⁸⁶ R |
| Exported binary64 coordinates | about 6.2×10⁻¹⁷ R |
| Coordinates quantized to binary32 | about 1.9×10⁻⁸ R |

The acceptance bound for exported binary64 constraints is 10⁻¹² R. The separate
binary32-quantization check is bounded by 10⁻⁷ R. Floating GPU transforms, line
thickness, perspective, bloom and pixel coverage introduce display effects;
they are not proofs that the raster image has 100-digit precision. Canonical
coordinates and the actual measurements remain available for inspection.
This is numerical constraint validation, not a formal interval-arithmetic proof
of existence or uniqueness of the selected local root.

Sri Yantra geometry must be animated only with whole-figure similarity
transforms: rigid translation/rotation and uniform scale. Color, emissive
intensity, opacity, depth placement and the surrounding mandala can modulate.
Individual triangle vertices must not wobble, because that would break the
audited incidences. The overlay and underlay share the same canonical source.

## Reproduce and inspect

Run `python3 tools/generate_yantra.py --output .work/generated` with
`tools/audit_independent.py` next to the builder. Both use Python's standard library.
The output contains binary64 coordinates, high-precision decimal coordinates,
the certificate, explicit active chamber vertices, all even-coverage voids,
and the independently reconstructed arrangement. `geometry-measurements.csv`
provides convenient triangle-height and angle measurements in radius units.

The independent auditor additionally uses perturbation controls. A width error
of 10⁻⁴ R can preserve the count of odd-coverage cells while breaking their
triangular shape. Requiring both 43 active cells and three noncollinear corners
per active cell prevents that near-fake from passing by count alone.

## Primary sources

- Gérard Huet, *Sri Yantra Geometry*, Theoretical Computer Science 281 (2002),
  609–628. DOI: 10.1016/S0304-3975(02)00028-2. Construction and appendix:
  https://sriyantraresearch.com/References/Gerard%20Huet.pdf
- Alessandro Chiodo, *On the construction of the Sri Yantra*, Comptes Rendus
  Mathématique 359(4) (2021), 377–397. DOI: 10.5802/crmath.163. Conditions
  (i)–(iii), four-dimensional family and discussion of additional constraints:
  https://www.numdam.org/item/10.5802/crmath.163.pdf
