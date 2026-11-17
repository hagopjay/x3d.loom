# Flop Lab expedition fold-back

This increment extends the attached Flop Lab source. It does not treat the
checkpoint's historical measurements as newly executed evidence. The statements
below are scoped incident records and proposed portable heuristics; they do not
add a universal law or claim a formal Loom release receipt.

## Evidence ledger

| Observation | Basis | Boundary |
|---|---|---|
| Original implementation and old run records exist in the attachment | Read the supplied patch and checkpoint | Their original environment and readers remain historical |
| Independent Node baseline: 22 core assertions, 12 physical gates and six caught Node controls | Fresh run by the upgrade QA agent; `test/new-controls.baseline.json` | The seventh historical control is browser-only and was not part of this Node run |
| Default X3D level: actual pinned XSD and semantic pass; two intended negative stages caught | `tools/validate_levels.py`, `receipts/upgrade-x3d.json` | 228,633-byte default only at this stage; no renderer or native-physics parity claim |
| State-scope probes | `test/new-controls.state-scope.mjs` and its JSON result | Confirms limited pose/snapshot domains; does not implement a full checkpoint |
| New Expedition, import and integration checks | See the final per-test validation records in this delivery | Counts must be taken from actual completed runs, not this draft |
| No GitHub PR was published from this workspace | Connector unavailable and CLI unauthenticated | The patch and complete PR draft remain reviewable local outputs |

## 1. A body snapshot is not a complete gameplay checkpoint

**Symptom.** The original profiler offered “resume from here” while its snapshot
covered body poses, velocities, off flags and world time only. `World.frame`,
controller timers, random-generator state, hook and temporary joints, collected
regions, water arrays, cannon/mission state and other game variables were not a
complete serialized state.

**Small reproducer.** Record a past pose before a collectible or hook event,
advance through the event, restore only the body snapshot, and inspect which
non-body state stayed at the later value. A visually plausible restored frame
cannot establish a deterministic continuation.

**Repair.** Treat scrubbing as visual review and return to the saved live state.
Keep a future full input-replay/checkpoint format as a separate versioned
capability. A ghost is also presentation-only.

**Executed scope probes.** `test/new-controls.state-scope.mjs` confirms that the pose fingerprint ignores a velocity-only change, snapshot restore leaves the frame counter, and hidden RNG advancement can lead to a later divergence despite restored body snapshots. Its phase-aligned repaired twin agrees. These probes demonstrate missing state domains; they are not a full-checkpoint implementation.

**Repaired twin / control.** A review action must not award new mission progress
or claim a past simulation state is complete. Returning live must restore the
retained live state, rather than continuing the selected historical pose.

**Heuristic.** Name the state domain a recording actually covers. A pose cache,
an input trace, a complete checkpoint and a video can all be valuable, but each
answers a different question.

## 2. Resource limits belong on the proposed result

**Symptom.** The original append check inspected the existing body count and a
few raw parameter products. A legal-looking request could exceed the remaining
budget after prefab expansion; negative or nonfinite dimensions could evade
simple upper-bound comparisons.

**Small reproducer.** Start near the body cap, request a multi-body prefab and
compare the expanded result with the declared cap. Separately test a negative
dimension, a nonfinite numeric value and an extremely large parameter product.

**Repair.** Validate typed finite inputs and the fully expanded candidate on a
copy, then commit the candidate atomically. Keep the previous world unchanged
when any stage rejects. Apply the same boundary to catalog actions, source
import and tool-driven construction rather than trusting one UI path.

**Repaired twin / control.** A candidate exactly within the declared bound is
accepted; a single increment beyond it is refused with the intended diagnostic;
the previous model remains byte-identical after refusal. See the current import
and integration tests for executed coverage.

**Heuristic.** A compact recipe is a program that expands resources. Bound its
result, not only its source length or current-world size.

## 3. Pose fingerprints and model identity are different instruments

**Symptom.** `World.hash()` is a 32-bit FNV-1a over x/y/angle. Calling it a general
state hash can imply coverage of velocities, controller state, water or model
configuration that it does not possess.

**Small reproducer.** Keep all poses fixed and change an un-hashed variable such
as velocity. The fingerprint need not change. Independently, build differing
models whose displayed initial poses happen to agree.

**Repair.** Name it a pose fingerprint and retain the cryptographic identity of
the actual model/engine separately. Compare models before comparing per-tick
fingerprints. A later complete-state digest requires a specified state schema,
ordering, numeric encoding and mutation controls.

**Heuristic.** A digest's useful meaning comes from its exact input domain. A
long hexadecimal string cannot repair incomplete subject selection.

## 4. A profiler value needs both a clock and a work unit

**Symptom.** A simulation tick duration, render CPU submission duration, frame
interval and GPU duration can all be displayed as “ms,” yet describe different
work. Catch-up frames can contain multiple fixed ticks.

**Small reproducer.** Lower the visual quality while keeping the physical model
fixed, then change substeps while keeping the view fixed. Observe which timing
changes. A draw-call timer cannot by itself isolate GPU execution.

**Repair.** Label CPU time per fixed simulation tick and CPU render submission
time explicitly. Report current renderer/frame observations on their actual
environment. Keep simulation, rendering and display cadence separate.

**Heuristic.** Every performance number needs a unit of work, timing boundary,
environment and workload. Prefer a diagnostic that distinguishes two plausible
bottlenecks over a dashboard that reports one unexplained average.

## 5. A successful X3D parse is a scoped bridge result

**Symptom.** Standard RigidBodyPhysics nodes coexist with custom metadata for
pill collisions, spring compliance, prefab recipes, game regions and material
rules. A valid file can remain behaviorally incomplete for another consumer.

**Small reproducer.** Export a pill or a fan, open the starting geometry in a
different X3D consumer, and distinguish the visible structure from the custom
solver behavior that consumer does not implement. Do not infer failure merely
because an intentionally different engine produces a different trajectory.

**Repair.** Document the supported slice, retain custom metadata, refuse
unsupported imports before world replacement, and name the expected losses.
Keep an independent schema/semantic validator distinct from the browser's
application contract.

**Heuristic.** An interchange claim needs a feature inventory and conserved
meaning. “It opens” is useful evidence for loading, not complete equivalence.

## 6. Authored objectives need causal eligibility

**Symptom.** A challenge can appear complete because it inherited old stars,
teleported to the finish, entered a high position without using the field, or
recorded a transient stunt distance without finishing the stunt.

**Repair.** Define fresh run baselines and causal predicates. Mark edited,
tuned or teleported runs as practice. Require the intended event chain for
field and cannon objectives; keep medals as authored game policy rather than
physical evidence.

**Repaired twin / control.** A legitimate event sequence completes the mission;
a near-miss missing its causal condition does not. Use fixed-step controller
tests and retain the exact criterion rather than treating a visual toast as the
only authority.

**Executed controller control.** `test/expedition.test.mjs` includes an old high
peak before fan entry and a separate later flop. Neither may complete Wind
Rider. The repaired controller records fan-entry height and the post-entry peak
in the same stunt. These are controller tests, not a measurement of actual
course feasibility or a renderer run.

**Heuristic.** An objective should measure the intended accomplishment, not an
easy proxy that intervention can satisfy accidentally.

## Additional code-read boundary: XPBD terminology

The current joint solver includes compliance divided by squared substep
duration in its correction denominator. It does not retain the accumulated
constraint multiplier of the full reference XPBD formulation. This supports
describing the lab as XPBD-style compliant position solving, but not an
unqualified claim of time-step/iteration-independent material behavior.
Any fuller implementation should arrive with a reference, a wrong twin and
measured cost/error comparison; it should not be folded into this upgrade
silently under a familiar algorithm name.

## Promotion checklist for the PR reviewer

- Read the actual final validation summary and per-test outputs.
- Retain the positive and negative specimens that distinguish each rule.
- Keep historical browser/cross-host measurements labeled as historical.
- Do not convert the new local gameplay result into a GPU, phone, real-player,
  cross-browser, live-model or formal Loom acceptance claim.
- If a portable rule is added to the central playbook, link its exact tests and
  state the smallest scope justified by those controls.
