# HAnim on the Babylon bridge: findings

Scope: HAnimHumanoid, HAnimJoint, HAnimSegment, HAnimSite, HAnimDisplacer, HAnimMotion (X3D 4.0 HAnim component, levels 1 and 2), bridged in batch 36 (bridge/BATCH-36.md has the per-node receipts).
Reference engine: X_ITE 16.6.0 (its source, `assets/components/HAnimComponent.js`, was read; its behaviour was measured by driving it). Rig for every number below unless a line says otherwise:
Chromium 153.0.8010.12 (Chrome for Testing), headless, SwiftShader (CPU only, WebGL2 for X_ITE, WebGPU through SwiftShader/Dawn for Babylon), Babylon.js 9.32.0, X_ITE 16.6.0, container with no GPU. Grades: Confirmed (measured on the rig), Likely (read from X_ITE source, not measured), Suspected.
No pixel perfection (standing rule): pictures are compared as silhouettes and mean difference, numbers as bounds.

## What was built

| node | Babylon side | status |
|---|---|---|
| HAnimHumanoid | TransformNode root; joints, segments, sites are TransformNodes under it; the skin is real Babylon skinning: one `Skeleton`, one `Bone` per entry of `joints`, per vertex `MatricesIndices/Weights` (+ the Extra pair for 5 to 8 influences), bone matrices set every frame from the joint fields, inverse bind matrices from `jointBindingPositions/Rotations/Scales` | bridged |
| HAnimJoint | TransformNode (center, scaleOrientation, scale, rotation, translation composed as X3D says), bone of the skeleton, `skinCoordIndex/Weight` turned into vertex weights, displacers | bridged |
| HAnimSegment | group; `coord` + `displacers` become morph targets on the shapes inside it that use that coord, in the segment's own frame | bridged |
| HAnimSite | Transform that rides its joint | bridged |
| HAnimDisplacer | one `MorphTarget` per displacer and skin mesh (dense positions), influence = weight (live: SAI, ROUTE) | bridged |
| HAnimMotion | event node: BVH style `channels` + `values`, a TimeSensor-like cycle, linear / slerp interpolation, drives the joints that the humanoid lists in `motions` | bridged |

Design choice (quality over X_ITE where they differ): Babylon skeleton + morph targets (GPU, the glTF pipeline) instead of a CPU copy of X_ITE's shader. The weight a vertex does not give to joints stays on the rest position as X_ITE does it (`skin = v + sum w (J v - v)`), which is exactly a weight `1 - sum w` on an extra bone whose matrix is the identity (negative when the joint weights add up to more than 1).

## X_ITE 16.6.0 behaviours (and traps), HAnimHumanoid / Joint

1. Skinning happens in the vertex shader only (`Skin2.glsl`). Joint matrix `J_i = bind_i * jointModelView_i * inverse(humanoidModelView)` with row vectors (bind applied first), uploaded as `humanoid.jointMatricesArray` (16 floats matrix + 16 floats normal matrix per joint). Index 0 is a virtual root joint with the identity; `joints[k]` is index `k + 1`. Confirmed (the array was read from a running scene, identity at rest, `0.7071 0.7071 0 0 -0.7071 0.7071 ... 0.7071 0.2929 0 1` for a 45 degree turn of a joint at (0, 1, 0)).
2. `jointBindingPositions` is the inverse of the rest transform, not the rest transform: with joints at 0 / 1 / 2 on the Y axis the rest pose is the identity only with `0 0 0, 0 -1 0, 0 -2 0`. Without binding values the skin is moved by the joint's own translation times its weight. The three arrays are indexed by the position in `joints` (not counting entries that are not HAnimJoint). Confirmed.
3. A shape is skinned only if its geometry's `coord` is the humanoid's `skinCoord` node (the same node by USE). `skinNormal`, `skinBindingCoords`, `skinBindingNormals` are not used at all. Likely (source), Confirmed for skinCoord by the fixtures.
4. A joint takes part only if the humanoid lists it in `joints`; the tree under `skeleton` only places it. A joint that is in the tree and not in the list moves its children but weighs nothing. Likely.
5. The weights need not add up to one, and a vertex without any influence stays at the rest position. Confirmed (shader source and the 0.2 / 1.0 weight run of the HAnimJoint fixture).
6. The X3D 4.0 XSD (x3d_mcp copy) lets an HAnimJoint hold only joints and segments, and an HAnimSite only inside a segment (its own child content model); a segment's `coord` cannot be written at all ("TODO add child Coordinate SFNode?" in the schema). The fixtures use `xsdElements` in the test spec to patch the one rule for `HAnimSegment`. Confirmed (xmllint).
7. Default of `llimit` / `ulimit` / `stiffness` is `0 0 0` (X3DUOM and X_ITE); the reader before this work gave `[]` and a field named `displacements` that is not in the standard. Fixed.

## HAnimDisplacer

8. X_ITE adds `joint rotation * (displacement * weight)` after skinning, with the matrix of the joint that owns the displacer and the *original* vertex for the joint terms; the weight is read live. Babylon morphs before skinning (the glTF order): `skin(v + d w)`. They are the same for a vertex that follows the displacer's joint alone (Confirmed: at most 8e-8 world units apart on the rig, 12 coordinates in 5 poses) and at the rest pose, and differ for a vertex shared by several joints: 0.053 (weight 0.5) and 0.106 (weight 1) world units on the half-J0 half-J1 ring of the HAnimDisplacer fixture for a 0.3 unit displacement in a 45 degree pose (Confirmed, same rig). Kept as a documented difference (scope of the node).
9. A displacer whose `coordIndex` is longer than `displacements` makes X_ITE throw `TypeError: undefined is not iterable` inside `set_displacementsTexture__`; the humanoid stops updating and a test run that depends on its frames hangs. The bridge skips the entries without a vector. (Confirmed: reproduced by setting `displacements` to 2 vectors while `coordIndex` still held 4; set `coordIndex` first.)
10. A displacer on a *segment*: X_ITE rotates the displacement by the segment's matrix in the humanoid frame and the shape's own transform rotates it again, so a bent segment shows the displaced vertices moved the wrong way (the HAnimDisplacer fixture's red quad collapses to a sliver at 90 degrees where the bridge draws the 0.7 x 0.3 rectangle). Confirmed by the picture (receipts/shots/HAnimDisplacer.bent.png). The bridge displaces in the segment's own frame; no rotation twice.

## HAnimMotion

11. `channels` is `"N chan chan chan, N chan ..."`: one group per name in `joints`, N is the channel count of the group and is only a separator for the parser (leading and trailing digits are stripped, the string is split at every number between spaces or commas). Names are `X|Y|Z` + `position|rotation|scale`; rotations are degrees and are composed in the order the channels appear (a group with fewer than three rotation channels is padded with the missing axes in X Y Z order: `Zrotation` alone is the order `ZXY`; more than three keep the first three). The Euler to quaternion formulas are gl-matrix's, one per order. Confirmed (all 12 pose comparisons agree to 1e-5 as quaternions).
12. `frameCount = floor(values / channels)` and is an outputOnly field written once, when `channels` or `values` change (and at load). At that moment X_ITE also resets `frameIndex = 0`, `startFrame = 0`, `endFrame = frameCount - 1`: the values written in the file for these three fields are discarded (a fixture with `startFrame="1" endFrame="2" frameIndex="1"` reads back 0 / 3 / 0 and plays the whole motion). Confirmed. Trap for authors.
13. Every enabled motion plays once at load, `loop` or not (`enabled` defaults to TRUE), over `(frameCount - 1) * frameDuration` seconds; a non-looping motion ends on its last frame and stops (Confirmed: elapsedTime 0.613 s for a 0.6 s motion, joint at the last frame; a 0.1 s steps run of 24 samples). Nothing is applied to the joints before the first frame of the playback, so a motion with `enabled="false"` leaves the joints at their authored pose until `frameIndex` is set. Enabling it again (`enabled` TRUE, even when it already is) starts a new play from the *frame the `frameIndex` field points at*. `loop` TRUE after a finished run starts it again; `enabled` FALSE stops it where it is; `frameIncrement` 0 turns the playback off altogether (X_ITE maps it to the internal TimeSensor's `enabled`: it does nothing for `next` but kills `enabled`, and setting it back to 1 does not start a non-looping play). Confirmed (probes p4, p5 of this lane, Chromium 153 / X_ITE 16.6.0).
14. The field `frameIndex` is not updated while the motion plays (no frameIndex events) and is not clamped when read back (set 7 of 4 frames: the pose is the last frame, the field keeps 7). `frameIndex` poses the joints only when the motion is not playing; while it plays it only moves the start fraction for the next play. Confirmed.
15. `next` / `previous` take the fraction of the last pose (`floor(fraction * (frameCount - 1))`, so a fraction that is a hair below a whole frame rounds down) plus or minus `frameIncrement`; past `endFrame` (or below `startFrame`) nothing happens unless `loop`, which wraps to the other end. `startFrame` and `endFrame` are clamped to `0..frameCount` (not `frameCount - 1`) and swapped if reversed. Confirmed for the plain, loop and increment 2 cases.
16. Only joints named in `joints` that the humanoid lists in `joints` are driven; `HumanoidRoot` is also `humanoid_root`; a joint named `IGNORED` is skipped; `motionsEnabled[i] = false` disconnects motion i; `channelsEnabled[j] = false` disconnects joint group j. The motion must be in the humanoid's `motions`. Confirmed (cases d and e of the p5 probe).
17. Joint values read back from X_ITE are 32 bit floats (`0.30000001192092896`); compare with a relative tolerance of 1e-5.

## Babylon side traps found

- Babylon's CPU skinning (`mesh.getPositionData(true, true)` / `applySkeleton`) skips weights that are not positive, so a negative weight on the rest bone (joint weights above 1) is lost there while the shader uses it. The probe the tests use (`bridge.hanim.probe`) therefore applies the shader's formula itself on the mesh buffers and the bone matrices; the picture comparisons check the GPU path.
- Skinned meshes need `alwaysSelectAsActiveMesh`: the bounding box stays the rest pose's.
- `Bone` takes the *absolute bind* matrix as its sixth constructor argument and uses its inverse as the inverse bind matrix; the bridge passes `inverse(jointBinding)` so that `final = jointBinding * jointMatrix` as X_ITE has it. All bones are parentless (the bridge computes each joint's matrix in the humanoid frame, chains included), which keeps unlisted intermediate joints exact.
- A shape the body rebuilds (a Coordinate changed) loses its bone weights and morph targets; the bridge binds again after every `rebuildShapeIn`.
- Node files load before `Body` exists in the bundle: wrappers of `Body.prototype` belong in `src/body-br.js`.
- Found while building the fixtures, not fixed: an IndexedFaceSet with `solid="false"` whose winding faces away from the viewer is drawn black by the body (flat normals come from the winding and nothing lights the back face); X_ITE lights both faces. Likely a Rendering gap (Suspected: other geometry too).

## Numbers (rig above)

| check | result |
|---|---|
| HAnimHumanoid bone matrices and 16 skinned positions, rest / bent 45 degrees / moved + scaled + turned | within 2e-5 of X_ITE on all (largest difference 1.1e-8 to 7.8e-8 world units) |
| HAnimHumanoid pictures (320 x 240) | iou 0.93 / 0.97 / 0.97, mad 1.7 / 1.7 / 2.6 (0..255), psnr 39.0 / 37.8 / 32.6 dB |
| HAnimMotion: 12 pose comparisons (end, frames 0 to 2, next, frame 7, run 1 to 2, channelsEnabled) joint translation and rotation | agree to 1e-5 (as quaternions); 104 of 104 steps pass in both engines |
| HAnimDisplacer: bone matrices, rings that follow the displacer joint, weights 1 / 0.5 / 0, lists changed at run time | within 1e-7 of X_ITE |
| HAnimDisplacer: ring shared by two joints, bent | 0.053 to 0.106 world units apart (design difference, item 8) |
| HAnimJoint: center + scale + scaleOrientation, weights and index list changed at run time | within 2e-5 of X_ITE; pictures iou 0.90 to 0.96 |
| HAnimSegment and HAnimSite pictures, rest / bent / hidden / moved | iou 0.92 to 0.97, mad 1.7 to 1.8 |

## What remains

- Skin normals: the shader transforms normals with the bone matrix; X_ITE blends the inverse transpose per joint (equal under rotation, different under non-uniform joint scale). Not measured.
- Only IndexedFaceSet and IndexedTriangleSet skins; other coordinate geometry (TriangleSet, QuadSet, ...) is not bound.
- More than 8 influences per vertex keep the 8 largest (a note is raised); X_ITE has no limit.
- Picking a skinned mesh uses the rest geometry (Suspected, not tested).
- Joint limits and stiffness are stored, not solved (X_ITE does not either). HAnimPose (4.1) and `HAnimHumanoid.displacers` (X_ITE only) are not in the 4.0 list and were not built.
- frameIndex / frameCount output events at the exact times of X_ITE are only compared at the ends of a run; a controlled clock would be needed for mid-run samples. The in-between check is a consistency test (position and rotation come from the same fraction).
- HAnimMotion `frameCount` 1 (a single frame) was not compared.
