# Independent upgrade audit and controls

This is an audit of the supplied Flop Lab source and this upgrade's executable
controls. It separates newly run Node/Python checks from the attachment's
historical browser and cross-host results. No browser automation, real-GPU
measurement, human playtest or formal Loom acceptance ran in this audit.

## Fresh baseline

`test/new-controls.baseline.json` retains the initial independent Node rerun:
**22 core assertions, 12 physical gates and six caught Node controls**. The
seventh control described in the checkpoint belonged to its browser run and
was not counted here. The test programs normally overwrite old receipt files;
the auditor saved and restored those historical bytes after collecting the
new report. Its source identities describe that initial run, before later
comment and presentation changes.

The default level contains 255 authored bodies and 182 authored joints. A
normal Sim adds a hero, eleven ragdoll bodies and ten ragdoll joints: its
reported totals are therefore 267 bodies and 192 joints. These are different
inventory domains, not a discrepancy to repair by changing a caption's number.

## Findings and bounded repairs

| Finding in supplied source | Observable consequence | Upgrade response |
|---|---|---|
| `World.hash()` covers body x/y/angle only | A velocity change can retain the same current fingerprint and diverge next step | Name the input domain: pose fingerprint; retain model/source identity separately |
| Body snapshots omit full controller, RNG, water, joint and frame state | A restored picture can look plausible without defining a reproducible continuation | Pose review and return-to-live, rather than a claim of branching deterministic resume |
| Spawn guard checked existing bodies and a few raw products | A prefab could overshoot the remaining count budget after expansion | Validate known finite parameters and the expanded candidate copy before committing it |
| Milliseconds lacked a precise work unit | A fixed tick, display frame and draw submission could be confused | Label fixed-step simulation CPU time and render CPU submission separately |
| Historical poses were displayed with live-tail diagnostic state | Contact, velocity and pair overlays could imply historical observations they did not retain | Review mode hides the mismatched overlays |
| A high peak before fan entry could satisfy Wind Rider | A spatial coincidence could stand in for the intended event order | Bind entry and post-entry rise to the same stunt; retain the old-peak and next-stunt negative controls |
| Original First Flight target exceeded the demonstrated ordinary jump/flop trajectory | A teaching mission could be awkward before its own lesson was learned | Authored target is now 0.8 s; a stock-spawn input trace demonstrates feasibility |

These are scoped application findings. For example, the review snapshot can
remain useful without becoming a full checkpoint; a ghost is deliberately a
visual guide. Reclassifying its scope is a valid repair when a new serialization
protocol would be a larger feature.

## Executed state and gameplay controls

`node test/new-controls.state-scope.mjs` runs three expected-scope probes:

1. Equal poses with different velocities retain the same current fingerprint,
   then diverge after a real step.
2. Body-snapshot restore rewinds world time but retains the frame counter.
3. Consuming one hidden random value changes a later ragdoll even after body
   restore; the phase-aligned repaired twin matches.

These controls document current boundaries. A future full-state checkpoint
implementation should replace the relevant expectations, rather than preserve
incompleteness merely to keep the old probe green.

`node test/expedition-integration.test.mjs` runs **eight integration controls**,
complementing the Expedition module's smaller controller fixtures. Its JSON
report is `test/new-controls.expedition-integration.json`.

- Neutral hooks preserve every pose fingerprint for 300 identical physical
  steps and leave the source level unchanged.
- A real grounded dash refuses; a legal airborne dash changes the trajectory
  relative to its disabled twin.
- Two 180-step dash input traces repeat on this host; the no-dash twin differs.
- Actual ragdoll airtime satisfies First Flight while upright airtime does not.
- From the stock spawn, settle 40 steps, jump on step 41, flop on step 46 and
  hold jump through step 70: the mission completes at approximately 1.55 s.
- A real respawn fails a challenge; retry establishes a fresh death baseline.
- An invalidated completed objective remains practice and creates no medal or
  best-run record.
- The actual mission-start/rebuild functions reset the physical clock and source
  obstacle poses while retaining campaign records. Free-play and unavailable
  mission controls preserve the current physical world. DOM and view adapters
  are non-browser stubs in this lifecycle control.

The normal-spawn result establishes one fixed input trace, not player feel or
browser input timing. The separate high-altitude control isolates objective
semantics and is explicitly not presented as normal-course completion.

## Larger X3D validation instrument

`python3 tools/validate_levels.py` invokes the actual pinned
`validation.validate.validate_xml(version='4.0')` and
`validation.semantic.semantic_diagnostics()` functions. The unchanged upstream
subset and its license live in `vendor/x3d_mcp/`; the wrapper verifies the
pinned origin manifest, all nineteen recorded file hashes, and loaded module
origins. XSD 4.0 and the upstream semantic UOM vocabulary 4.1 are recorded
separately. This is a direct local call, not a network MCP server.

The wrapper has an explicit **2 MiB per-file** budget suitable for the original
228,633-byte level. It does not raise or monkeypatch another application's cap.
Oversized files are refused before their full contents are read or hashed.
Arbitrary DTD/entity declarations are refused; the exporter's exact optional
fixed X3D declaration remains supported.

`python3 test/new-controls.validator.py` checks a healthy repaired scene,
refusal of an unrelated preloaded validator module, an over-budget `not_run`
outcome, and refusal after one consumed source file changes in an isolated
temporary vendor copy. The shipped vendor is never corrupted by the control.
`receipts/upgrade-x3d.json` additionally contains actual positive/negative
XSD and semantic controls and the result for every `level/*.x3d` file present
when that command ran.

Passing these checks does not establish native X3D physics parity. Read
`docs/X3D-CONTRACT.md` for the custom 2.5D mapping and metadata losses, and
`docs/FOLDBACK.md` for the portable lessons proposed to the reviewer.
