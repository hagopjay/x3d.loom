# Modeling-and-simulation study card (`downey.card/1`)

For a study that models a system the way Downey's *Modeling and Simulation in Python* teaches: abstraction, a
ladder of models, analysis and simulation, validation. Fill it **before** the first run and commit it; its `limits`
block is what the run answers to (law 44). x3d.downey keeps one JSON card per room (`cards/<room>.card.json`); this
is the same card in prose. Each field names the Loom rule it serves.

1. **question**: one sentence a person would ask about the system.
2. **system**: the real thing, with its scale.
3. **purpose**: prediction, explanation or design. It picks the decisive check: data for prediction (a hold-out),
   a mechanism for explanation (an invariance or identity), a certificate for design (the optimum and its neighbours).
4. **abstraction.kept** and **abstraction.left_out**: each omission with its expected effect and whether it was
   measured (law 40: shown, not dropped).
5. **params**: value, unit (parsed by the units witness), source with chapter or citation. One spelling per value.
6. **band**: the measured range of any uncertain parameter, and why; claims must hold over all of it.
7. **ladder**: rung 0 the simplest model; each later rung `adds` exactly one feature (law 29).
8. **references**: for every check, its kind: closed-form, discrete-identity (the scheme's own exact answer),
   invariant (admits, never confirms: law 21), limit-agreement (a rung with its feature off is the rung below),
   order, event, data, robustness, design, units. Prefer an exact discrete identity to the continuum answer for a
   stepped model, and report the scheme gap as a known number.
9. **limits**: one per reference, written now, committed now.
10. **exploration**: the numbers seen while exploring the instrument before the limits were written, including the
    worst case (SCIENCE-PLAYBOOK §1).
11. **dysfunctions**: the common bugs for this kind of model, each a one-line mutant with the checks expected to
    catch it. A mutant expected to survive (it changes nothing the model can see) says so and why.
12. **claims**: each with its significant figures, rendered from the bank, never typed by hand. Counts and quoted
    inputs are marked `[[...]]` so the figures witness skips them.
13. **lenses**: Explorer, Lab, Instrument (X3D-STEM.md §2): the words change, the data never.
14. **disagreements**: where the sources disagree, both, and how the card resolves it (never by silently picking one).
