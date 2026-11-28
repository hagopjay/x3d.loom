# x3d.engineering

Two worked studies that paid for [ENGINEERING-PLAYBOOK.md](../ENGINEERING-PLAYBOOK.md) (28 November 2026). Both are worked examples: **not for construction**, and no licensed engineer has reviewed either. Every number is measured by the thread that built it and stays Likely until a second reader recomputes it (law 44).

| Study | What it is | Result | Receipt |
|---|---|---|---|
| [fourbar/](fourbar/) | A Grashof crank-rocker judged on paper (kinematics, transmission angle, buckling, pin shear) and stepped on three rigid-body engines from one X3D file | 10 of 10 gates, 8 of 8 controls caught | `runs/engineering-fourbar-20261128/`, re-issued in `-r2` after the adapter change |
| [ifc-truss/](ifc-truss/) | An IFC4 building compared element by element with its X3D scene (a loss receipt), then a roof truss designed across its court and written as IFC4 and X3D | 22 of 22 gates, 13 of 13 controls caught | `runs/engineering-ifc-truss-20261128/`, re-issued in `-r2` on the fixed validator |

## Run them

```sh
# needs: the x3d_mcp checkout with its venv, Node 22, Python 3.11+
export LOOM_FORK=/path/to/x3d_mcp
(cd x3d.physics/rigid-engines && npm install)        # engines for fourbar
x3d.engineering/accept.sh fourbar

pip install ifcopenshell                             # 0.9.0.post1 was used
export X3D_DEMO=/path/to/x3d.demo                    # the building's IFC and X3D live there
x3d.engineering/accept.sh ifc-truss
```

`accept.sh` rebuilds the study, runs Grammar, Meaning and Traps on every scene, runs the study's own `check.py` as the `requirements` witness, accepts under `kit/profiles/x3d-engineering.json`, writes a receipt, and then touches a scene to prove the gate rejects a stale witness.

## Layout of a study

| File | Role |
|---|---|
| `card.json` | Requirements, limits, references, controls. Committed before the run of record |
| `fourbar.py`, `truss.py`, `exchange.py` | The model and the generators. No scene or IFC here is edited by hand |
| `check.py` | The witness. Exit 0 only when every gate passes and every control is caught |
| `bank/`, `model/` | Generated inputs: the kinematics bank, the truss IFC |
| `scenes/` | Every X3D file, all through Grammar and Meaning |
| `controls/` | Files kept because they fail something on purpose |
| `results/` | `verdict.json`, loss receipts, the design bank |
| `stills/` | Pictures with `rig.json` naming the browser, X_ITE version and renderer |
| `.work/` | Scratch (engine trajectories); never shipped, not in the candidate |

## The three things worth knowing before you build on these

1. **A SingleAxisHingeJoint is not a portable crank pin.** X3D 4.0 clause 37.4.12 stops a hinge π from where it started; ODE's convention, which two adapters here follow, treats a stop at exactly π as no stop. The built-in engine stops, Rapier and cannon-es turn and say so, and `hingeStop: 'x3d'` makes them stop (`fourbar/scenes/control-four-hinges.x3d`).
2. **Counts cannot see a swap.** 111 of 111 ids, names and classes still match when two elements trade identities. Only per-element quantities catch it (`ifc-truss/check.py`, control `swap-two-guids`).
3. **Four of the five code clauses behind the truss are recalled, not read.** The card grades each one (`ifc-truss/card.json`, `codes`).
