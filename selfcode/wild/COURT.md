# The wild set in a browser: what is expected

Written and committed before `court_wild.py` was run.

The wild run's 39 "rebuilt" verdicts are the simulator's. This sends a sample to a second engine: the first 12 rebuilt
scenes in hash order, each original against the scene the search wrote, in X_ITE (headless Chromium) through
x3d-blender-io's pair judge at `8f3fc54`, three replays each, watched for 6 seconds. Six seconds is a slice of the slow
scenes (some loops are 30 s and more), chosen to keep the run under ten minutes; it can show a wrong direction or speed,
not a fault late in a loop.

Expected:

- **C1.** At least 10 of the 12 sampled solutions are judged "same" and none "differs".
- **C2.** Every control is judged "differs". A control is a written scene whose half-turn key 3.14159265 is printed to
  six decimals (failure mode 357).

If a solution "differs", the simulator and the browser disagree about a real scene, and that goes to the node editor
thread as a simulator finding.
