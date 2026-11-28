# An opt-in profile, crossed: the X3D SimReady profile draft 2 (27 Nov 2026)

**What was built.** The USD parity ledger (x3d_mcp `docs/USD-VALIDATION-PARITY.md`) said 66 of the 340 pinned USD rules are
mistakes X3D can state, and filed 92 SimReady rules as "policy". x3d_mcp PR 40 defines where an X3D file writes 20 of those
facts and checks them; x3d.nVidia PR 4 carries them to USD and has NVIDIA's validator judge the result. Failure modes 497 to
504 in LOOM-v1.md section 8 come from this. No new law.

| | Number | Source |
|---|---|---|
| Rules pinned | 340 | usd-core 26.11 (30), omniverse-asset-validator 1.18.0 (40), NVIDIA/simready-foundation c3bd1d8 (270) |
| Stated by plain X3D and checked | 66 | unchanged; `tests/usd_parity.py`, one failing and one passing scene per check |
| Open in plain X3D, closed by the opt-in profile, checked | 20 | new status `profile`; 19 proof pairs |
| Stated and checked in all | 86 of 340 | always quoted as 66 plus 20 |
| Crossed and confirmed both ways | 19 of 20 | usd-validation-nvidia 1.23.0, tiers 2026.10.0, Python 3.12.3; `q12/receipts/profile-crossing-20261127.json` |
| X3D-only | 1 (VG.021) | no executable SimReady rule at c3bd1d8 |
| Warning-side pairs confirmed | 2 of 2 | VG.MESH.001, CITY.001 |
| Kernel suite | 2017 passed, 27 skipped, 1 expected failure | was 1984 passed |

Grades: C, measured by the thread that built it, so **Likely** under law 44 until a second reader reruns the crossing.

## What "crossed" means

A check claimed for a foreign rule has four cells to fill, not two:

| | X3D check | Foreign validator on the converted file |
|---|---|---|
| failing scene | reports | fails |
| passing scene | quiet | passes |

The parity ledger before this filled only the left column. The crossing fills the right one with the other party's own
tool, on the same pair. Three things only showed up in the right column: the converter was writing a constant for the unit
(FM 499), two rules could not be failed by any input (FM 498), and the check's severity and count did not match the rule it
mirrored (FM 502).

## The opt-in rule

A profile check that ran on every file would report "no licence" and "not triangulated" on every existing scene. The profile
is therefore silent unless the file carries a `simready:` meta element, and a capability rule (at least one body, every shape
labelled) is asked only of a file that claims the feature. One test holds this: the worst file the checks can imagine, with no
opt-in, returns nothing (`tests/test_simready_profile.py`).

## Limits

- One proof pair per rule shows agreement on the case the rule was written for. It does not show agreement on real files.
  The next step is Q12-style: both validators over a real corpus that opts in, fired pairs only (FM 373).
- 71 SimReady rules remain policy. The mate, connection, gripper and AIF equipment profiles are each a convention of their own.
- The label vocabularies are third-party lists (names only) taken from the pinned rulebook; x3d_mcp `NOTICE-simready-vocab.md`
  carries the sources and a takedown notice.
