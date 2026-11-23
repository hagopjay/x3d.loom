# R2R run: Fault Lab v1: ten planted ontology faults, one clean scene

Made 2026-11-23T06:29:49Z by loomkit.r2r 0.1.0 (source sha256 `096d1ce649f8b276`), X3DUOM 4.1 sha256 `4fc10e8e15c0d6cf`. No language model was used. Every rule below is a **candidate**: nothing here is promoted, and a grade is always relative to the instrument named.

**7 candidate rule(s) from 10 failure cluster(s): 0 Confirmed, 0 Likely, 7 Suspected.** 11 events (passes and failures) over 8 distinct files; 0.1 s.

How to read a grade. **C, Confirmed**: the failures were observed by a tool, the rule fires on no file the tool passed, and it called outcomes it had never seen (probes built after the rule was fixed, or held-out receipts). **L, Likely**: clean on what induction saw, but nothing unseen has tested it. **S, Suspected**: a prediction was wrong, or the rule leans on literal values, or the evidence is one failure. **Closure** is separate: `open` means failures of the same signature exist that no rule here fires on, so a Confirmed rule can still be incomplete.

Use the candidates as a pre-flight check: `kit/loom r2r check THIS_FOLDER FILE.x3d`. List what is still open: `kit/loom r2r needs THIS_FOLDER`.

## Instruments and what they said

| Instrument | Failed | Passed |
|---|---:|---:|
| Fault Lab author (planted faults, x3d.demo fault-lab/v1) | 10 | 1 |

- x3d.demo docs/demos/fault-lab/v1 at main 8715b23. The failures are AUTHORED: a person planted each fault and says the file is wrong. No tool observed them, so no rule from this run can be graded above Likely, and with one clean file there is nothing to count false alarms on.
- For comparison only: the hand-written checks of x3d_mcp flagged 1 of 10 at 39c6e94 and 9 of 10 at 8205047 (the Fault Lab's own checks-before.json and checks-after.json).

## Receipts read

| Receipt | What | sha256 |
|---|---|---|
| `repos:x3d.demo/docs/demos/fault-lab/v1/data/cases.json` | Fault Lab cases.json: 10 planted faults and the clean twin | `a87cbb577f86b516` |

## Candidates at a glance

| Grade | Rule | Instrument and signature | Sources explained | Known-good false alarms | Held-out caught | Held-out false alarms | Audit probes right / wrong / missed | Closure |
|---|---|---|---:|---:|---:|---:|---:|---|
| **S** | [`r2r-774b223978ea`](candidates/r2r-774b223978ea.json) `attr[v:eq:103.867 13.4125 300 & at:GeoViewpoint@position]` | Fault Lab author (planted faults, x3d.demo fault-lab/v1): `planted fault: angkor-swapped` | 1 of 1 | 0 of 1 | none to test | 0 of 0 | 0 / 0 / 0 | untested |
| **S** | [`r2r-f5ff0855ade8`](candidates/r2r-f5ff0855ade8.json) `elem[x:no_children & n:Cylinder]` | Fault Lab author (planted faults, x3d.demo fault-lab/v1): `planted fault: cylinder-shaft` | 1 of 1 | 0 of 1 | none to test | 0 of 0 | 0 / 0 / 0 | untested |
| **S** | [`r2r-5693ea825a71`](candidates/r2r-5693ea825a71.json) `attr[v:eq:31.1342 29.9792 300 & at:GeoViewpoint@position]` | Fault Lab author (planted faults, x3d.demo fault-lab/v1): `planted fault: giza-swapped` | 1 of 1 | 0 of 1 | none to test | 0 of 0 | 0 / 0 / 0 | untested |
| **S** | [`r2r-a43d46b79b29`](candidates/r2r-a43d46b79b29.json) `attr[v:not_all_equal & at:Transform@scale]` | Fault Lab author (planted faults, x3d.demo fault-lab/v1): `planted fault: scaled-shaft` | 1 of 1 | 0 of 1 | none to test | 0 of 0 | 0 / 0 / 0 | untested |
| **S** | [`r2r-6bc38d2119c0`](candidates/r2r-6bc38d2119c0.json) `attr[v:tok:-50 & at:Transform@translation]` | Fault Lab author (planted faults, x3d.demo fault-lab/v1): `planted fault: secret-tunnel` | 1 of 1 | 0 of 1 | none to test | 0 of 0 | 0 / 0 / 0 | untested |
| **S** | [`r2r-c3d56d0fa43d`](candidates/r2r-c3d56d0fa43d.json) `elem[x:sfnode_multiple & n:Sphere]` | Fault Lab author (planted faults, x3d.demo fault-lab/v1): `planted fault: two-geometries` | 1 of 1 | 0 of 1 | none to test | 0 of 0 | 0 / 0 / 0 | untested |
| **S** | [`r2r-93a51b8e17f9`](candidates/r2r-93a51b8e17f9.json) `elem[x:sfnode_multiple & n:PhysicalMaterial]` | Fault Lab author (planted faults, x3d.demo fault-lab/v1): `planted fault: two-materials` | 1 of 1 | 0 of 1 | none to test | 0 of 0 | 0 / 0 / 0 | untested |

## Clusters

### `planted fault: angkor-swapped`

Instrument: Fault Lab author (planted faults, x3d.demo fault-lab/v1). 1 distinct failing file(s) in training (1 events), 0 held-out event(s). Not probed (no oracle for this instrument).

#### S (Suspected) `r2r-774b223978ea`

> At one attribute where the place is GeoViewpoint position: the value is exactly `103.867 13.4125 300`.

`{"all": ["v:eq:103.867 13.4125 300", "at:GeoViewpoint@position"], "kind": "attr"}`

Grade reasons: leans on literal values (a fingerprint): the vocabulary lacks a word for what they share; rests on one failure and no confirmed probe. Closure: **untested** (too few probes outside the rule to say).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 1 of 1 (1 with a known-good twin; observed by 1 authored) |
| Fires on files the instrument passed | 0 of 1 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 0 |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 1 checked |

Seen at 1 place(s): GeoViewpoint@position.
Unfenced reading `attr[v:eq:103.867 13.4125 300]`: untested beyond the fence (0 false alarm(s) on known-good files).

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `v:eq:103.867 13.4125 300` | test | 1 | 1 |
| `at:GeoViewpoint@position` | context | 0 | 1 |

How the rule was reached: `seed v:eq:103.867 13.4125 300, fenced to at:GeoViewpoint@position: explains 1, false alarms 0`.

Sources (1; first 1):
- `repos:x3d.demo/docs/demos/fault-lab/v1/cases/angkor-swapped.x3d` (Longitude written first (Angkor))

### `planted fault: cylinder-shaft`

Instrument: Fault Lab author (planted faults, x3d.demo fault-lab/v1). 1 distinct failing file(s) in training (1 events), 0 held-out event(s). Not probed (no oracle for this instrument).

#### S (Suspected) `r2r-f5ff0855ade8`

> At one element where the node is Cylinder: it has no children.

`{"all": ["x:no_children", "n:Cylinder"], "kind": "elem"}`

Grade reasons: rests on one failure and no confirmed probe. Closure: **untested** (too few probes outside the rule to say).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 1 of 1 (1 with a known-good twin; observed by 1 authored) |
| Fires on files the instrument passed | 0 of 1 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 0 |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 1 checked |

Seen at 1 place(s): Cylinder.
Unfenced reading `elem[x:no_children]`: contradicted by passing files (1 false alarm(s) on known-good files).

Alternates the receipts could not rule out (8):
- `elem[!child:Box & (one of 2 places)]`
- `elem[x:present & n:Cylinder]`
- `elem[x:present & isa:X3DGeometryNode & n:Cylinder]`
- `attr[v:present & isa:X3DGeometryNode & (one of 2 places)]`
Literals whose removal changes nothing on this evidence: `x:no_children`.

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `x:no_children` | test | 0 | 1 |
| `n:Cylinder` | context | 1 | 1 |

How the rule was reached: `seed x:no_children, fenced to n:Cylinder: explains 1, false alarms 0`.

Sources (1; first 1):
- `repos:x3d.demo/docs/demos/fault-lab/v1/cases/cylinder-shaft.x3d` (Shaft redrawn as a Cylinder)

### `planted fault: feet-not-metres`

Instrument: Fault Lab author (planted faults, x3d.demo fault-lab/v1). 1 distinct failing file(s) in training (1 events), 0 held-out event(s). Not probed (no oracle for this instrument).
- **No clean rule.** Best efforts that still raise false alarms:

### `planted fault: ghost-def`

Instrument: Fault Lab author (planted faults, x3d.demo fault-lab/v1). 1 distinct failing file(s) in training (1 events), 0 held-out event(s). Not probed (no oracle for this instrument).
- **No clean rule.** Best efforts that still raise false alarms:

### `planted fault: giza-swapped`

Instrument: Fault Lab author (planted faults, x3d.demo fault-lab/v1). 1 distinct failing file(s) in training (1 events), 0 held-out event(s). Not probed (no oracle for this instrument).

#### S (Suspected) `r2r-5693ea825a71`

> At one attribute where the place is GeoViewpoint position: the value is exactly `31.1342 29.9792 300`.

`{"all": ["v:eq:31.1342 29.9792 300", "at:GeoViewpoint@position"], "kind": "attr"}`

Grade reasons: leans on literal values (a fingerprint): the vocabulary lacks a word for what they share; rests on one failure and no confirmed probe. Closure: **untested** (too few probes outside the rule to say).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 1 of 1 (1 with a known-good twin; observed by 1 authored) |
| Fires on files the instrument passed | 0 of 1 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 0 |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 1 checked |

Seen at 1 place(s): GeoViewpoint@position.
Unfenced reading `attr[v:eq:31.1342 29.9792 300]`: untested beyond the fence (0 false alarm(s) on known-good files).

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `v:eq:31.1342 29.9792 300` | test | 1 | 1 |
| `at:GeoViewpoint@position` | context | 0 | 1 |

How the rule was reached: `seed v:eq:31.1342 29.9792 300, fenced to at:GeoViewpoint@position: explains 1, false alarms 0`.

Sources (1; first 1):
- `repos:x3d.demo/docs/demos/fault-lab/v1/cases/giza-swapped.x3d` (Longitude written first (Giza))

### `planted fault: no-tier`

Instrument: Fault Lab author (planted faults, x3d.demo fault-lab/v1). 1 distinct failing file(s) in training (1 events), 0 held-out event(s). Not probed (no oracle for this instrument).
- **No clean rule.** Best efforts that still raise false alarms:

### `planted fault: scaled-shaft`

Instrument: Fault Lab author (planted faults, x3d.demo fault-lab/v1). 1 distinct failing file(s) in training (1 events), 0 held-out event(s). Not probed (no oracle for this instrument).

#### S (Suspected) `r2r-a43d46b79b29`

> At one attribute where the place is Transform scale: the components are not all equal.

`{"all": ["v:not_all_equal", "at:Transform@scale"], "kind": "attr"}`

Grade reasons: rests on one failure and no confirmed probe. Closure: **untested** (too few probes outside the rule to say).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 1 of 1 (1 with a known-good twin; observed by 1 authored) |
| Fires on files the instrument passed | 0 of 1 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 0 |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 1 checked |

Seen at 1 place(s): Transform@scale.
Unfenced reading `attr[v:not_all_equal]`: contradicted by passing files (1 false alarm(s) on known-good files).

Alternates the receipts could not rule out (8):
- `attr[v:present & at:Transform@scale]`
- `attr[v:not_all_equal & a:scale & at:Transform@scale]`
- `attr[v:not_all_equal & at:Transform@translation & e.has:scale]`
- `attr[v:present & a:scale & at:Transform@scale]`
Literals whose removal changes nothing on this evidence: `v:not_all_equal`.

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `v:not_all_equal` | test | 0 | 1 |
| `at:Transform@scale` | context | 1 | 1 |

How the rule was reached: `seed v:not_all_equal, fenced to 2 place(s): explains 1, false alarms 1`; then `+ at:Transform@scale: explains 1, false alarms 0 (gain 1.00)`.

Sources (1; first 1):
- `repos:x3d.demo/docs/demos/fault-lab/v1/cases/scaled-shaft.x3d` (Shaft stretched by a scale)

### `planted fault: secret-tunnel`

Instrument: Fault Lab author (planted faults, x3d.demo fault-lab/v1). 1 distinct failing file(s) in training (1 events), 0 held-out event(s). Not probed (no oracle for this instrument).

#### S (Suspected) `r2r-6bc38d2119c0`

> At one attribute where the place is Transform translation: the value has the token `-50`.

`{"all": ["v:tok:-50", "at:Transform@translation"], "kind": "attr"}`

Grade reasons: leans on literal values (a fingerprint): the vocabulary lacks a word for what they share; rests on one failure and no confirmed probe. Closure: **untested** (too few probes outside the rule to say).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 1 of 1 (1 with a known-good twin; observed by 1 authored) |
| Fires on files the instrument passed | 0 of 1 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 0 |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 1 checked |

Seen at 1 place(s): Transform@translation.
Unfenced reading `attr[v:tok:-50]`: untested beyond the fence (0 false alarm(s) on known-good files).

Alternates the receipts could not rule out (8):
- `attr[v:eq:0 -50 0 & at:Transform@translation]`
- `attr[v:eq:0.9 0.3 0.9 & at:PhysicalMaterial@baseColor]`
- `attr[v:eq:90 3 3 & at:Box@size]`
- `attr[v:eq:SecretTunnel & at:Transform@DEF]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `v:tok:-50` | test | 1 | 1 |
| `at:Transform@translation` | context | 0 | 1 |

How the rule was reached: `seed v:tok:-50, fenced to at:Transform@translation: explains 1, false alarms 0`.

Sources (1; first 1):
- `repos:x3d.demo/docs/demos/fault-lab/v1/cases/secret-tunnel.x3d` (A tunnel nobody recorded)

### `planted fault: two-geometries`

Instrument: Fault Lab author (planted faults, x3d.demo fault-lab/v1). 1 distinct failing file(s) in training (1 events), 0 held-out event(s). Not probed (no oracle for this instrument).

#### S (Suspected) `r2r-c3d56d0fa43d`

> At one element where the node is Sphere: it is a second node in a field that holds one node.

`{"all": ["x:sfnode_multiple", "n:Sphere"], "kind": "elem"}`

Grade reasons: rests on one failure and no confirmed probe. Closure: **untested** (too few probes outside the rule to say).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 1 of 1 (1 with a known-good twin; observed by 1 authored) |
| Fires on files the instrument passed | 0 of 1 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 0 |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 1 checked |

Seen at 1 place(s): Sphere.
Unfenced reading `elem[x:sfnode_multiple]`: untested beyond the fence (0 false alarm(s) on known-good files).
Normative reading: every explained failure also has `x:sfnode_multiple` (it is a second node in a field that holds one node); 0 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (8):
- `elem[x:no_children & n:Sphere]`
- `elem[x:present & n:Sphere]`
- `elem[x:present & isa:X3DGeometryNode & n:Sphere]`
- `attr[v:present & at:Sphere@radius & isa:X3DGeometryNode]`
Literals whose removal changes nothing on this evidence: `x:sfnode_multiple`.

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `x:sfnode_multiple` | test | 0 | 1 |
| `n:Sphere` | context | 0 | 1 |

How the rule was reached: `seed x:sfnode_multiple, fenced to n:Sphere: explains 1, false alarms 0`.

Sources (1; first 1):
- `repos:x3d.demo/docs/demos/fault-lab/v1/cases/two-geometries.x3d` (Two geometries in one Shape)

### `planted fault: two-materials`

Instrument: Fault Lab author (planted faults, x3d.demo fault-lab/v1). 1 distinct failing file(s) in training (1 events), 0 held-out event(s). Not probed (no oracle for this instrument).

#### S (Suspected) `r2r-93a51b8e17f9`

> At one element where the node is PhysicalMaterial: it is a second node in a field that holds one node.

`{"all": ["x:sfnode_multiple", "n:PhysicalMaterial"], "kind": "elem"}`

Grade reasons: rests on one failure and no confirmed probe. Closure: **untested** (too few probes outside the rule to say).

| Test | Result |
|---|---|
| Source failures explained at the changed site | 1 of 1 (1 with a known-good twin; observed by 1 authored) |
| Fires on files the instrument passed | 0 of 1 |
| Held-out failures caught (content-disjoint) | none to test |
| Held-out false alarms | 0 of 0 |
| Degenerate files it fires on | none of 8 |
| Already covered by an existing Loom trap | 0 of 1 checked |

Seen at 1 place(s): PhysicalMaterial.
Unfenced reading `elem[x:sfnode_multiple]`: untested beyond the fence (0 false alarm(s) on known-good files).
Normative reading: every explained failure also has `x:sfnode_multiple` (it is a second node in a field that holds one node); 0 passing file(s) have it too inside the fence.

Alternates the receipts could not rule out (8):
- `elem[!has:emissiveColor & n:PhysicalMaterial]`
- `elem[!has:transparency & n:PhysicalMaterial]`
- `attr[v:all_zero & !e.has:emissiveColor & at:PhysicalMaterial@metallic]`
- `attr[v:all_at_min & !e.has:emissiveColor & at:PhysicalMaterial@metallic]`

Ablation (drop one literal, count again):

| Dropped | Role | False alarms without it | Failures explained without it |
|---|---|---:|---:|
| `x:sfnode_multiple` | test | 1 | 1 |
| `n:PhysicalMaterial` | context | 0 | 1 |

How the rule was reached: `seed x:sfnode_multiple, fenced to n:PhysicalMaterial: explains 1, false alarms 0`.

Sources (1; first 1):
- `repos:x3d.demo/docs/demos/fault-lab/v1/cases/two-materials.x3d` (Two materials on one surface)
