# Blind court 3: written down before the seal is opened

27 November 2026. This file is committed and pushed before anyone who edits the kernel has read the test set.
It says what was sealed, which kernel is frozen, how a catch is counted, and what we expect. The results page
beside it is written afterwards and may not change this one.

## Why a third court

Courts 2 and 2b (`flywheel/sprint-20261126/fault-court-2`, `fault-court-2b`) gave the only blind score the kernel
has: 24 of 40 at x3d_mcp `96e2849` (behaviour 11 of 20, structure 13 of 20). Checks were then written from their
misses, so both sets are seen and every later score on them is a fix confirmation. The meta-review of 26 November
named that leak (a rule written after the test, within about 20 minutes). This court closes it by order of events:
the set is sealed by hash, the kernel is frozen by commit, and only then is the set opened and scored, once.

## What is sealed

Two authors, each a fresh agent that was forbidden to read any repository, memory or earlier test set, with only the
public X3D 4.0 XSD and X_ITE 16.8.0 to hand. Each wrote 20 planted faults, a corrected twin for every fault, and 5
legal decoys, and reported back only counts and a hash.

| Set | Author's brief | Files | Archive sha256 | Sealed (UTC) |
|---|---|---|---|---|
| A behaviour | what a scene does over time or on interaction | 20 faults, 20 twins, 5 decoys | `5a0a468c62b684eb1761e7ce63b1b7963a6c4734bea6ad44c366a2f68f0f3e76` | 21:54:52 |
| B structure and data | a static scene that is wrong | 20 faults, 20 twins, 5 decoys | `bf2da6146a711707e9eb52edb6297628f0703fd9cc896fa2fa5bcba366e0cc74` | 21:55:15 |

Authors' own counts, not yet checked by us: set A has 0 schema-invalid faults, 15 of 20 pairs witnessed in X_ITE and
5 reasoned, 1 pair where the browser disagreed with the author; set B has 5 schema-invalid faults, 19 of 20 pairs
witnessed and 1 reasoned, 0 disagreements. All 10 decoys loaded with no console error (X_ITE 16.8.0, Chromium
158.0.8127.36 headless, ANGLE on SwiftShader, Playwright 1.63.0).

## What is frozen

| Kernel | Commit | What it is |
|---|---|---|
| Old | x3d_mcp `ebe969b` (main) | Its `src/` is byte-identical to `96e2849`, the kernel courts 2 and 2b were scored on |
| New | x3d_mcp `1da3547` plus tests only | Old plus 11 checks: 8 for "wired legally, does nothing" and 3 for the structure misses (degrees for radians, Extrusion with too few points, light with direction 0 0 0) |

Source hashes at the freeze (sha256): `src/validation/inert_checks.py` `e1a568f0e75e…d790814`,
`src/validation/data_checks.py` `9e6a70e70711…a1d23fb2`. Nothing under `src/` changes between this file and the
scoring run; the results page prints the two hashes again.

## Two leaks, stated

The authors were told to report no content. They mostly did. What reached the kernel editor before the freeze
commit, from the authors' closing reports:

1. Set B: two faults (numbers 10 and 11) concern NURBS, one of them the NURBS component.
2. Set A: four scenes use BooleanToggle, StringSensor, Text, IntegerSequencer or Script, and one needs the viewer to
   move.

The last edit to the kernel source was made before either report arrived, and no check was added, removed or
retuned after them. The kernel has no NURBS check; its profile and component check is the one already on main.
A reader who wants to discount for this can drop set B faults 10 and 11; the results page gives the score both ways.

## A known confound

The kit's copy of X_ITE had no component files, so both authors declared `profile='Interchange'` with explicit
component statements in most files. The kernel checks declared components against the nodes used. A complaint about
components on a fault file is not a catch unless the planted mistake is about components, and a complaint about
components on a twin or decoy is counted as a flag and then judged right or wrong like any other.

## How a catch is counted

The same script runs both kernels on all 90 files once and saves every diagnostic.

- **Caught (the rule courts 2 and 2b used):** the file fails the X3D 4.0 XSD, or at least one diagnostic at any
  level names the planted mistake.
- **Caught, strict:** the file fails the XSD, or a diagnostic at warning or error level names the planted mistake.
- **Who decides "names the planted mistake":** two readers, separately. One is a fresh agent that has not read
  the kernel and is given only the manifests and the diagnostics. The other is the kernel editor. The fresh
  reader's count is the headline; the editor's count and every disagreement are printed beside it.
- **Faults stay in the denominator** even when the author's own witness says the browser disagreed. A fault is set
  aside only if both readers find the fault file and its twin equivalent, and then both scores are printed.
- **False alarms:** any warning or error on a twin or a decoy is a flag (50 legal files). Each flag is judged right
  (the file really has that problem) or wrong.
- **One run.** No check is changed and the set is not rescored after it is opened. After the results are written
  the set is seen, and joins courts 2 and 2b as a regression set.

## What we expect

Written by the kernel editor, who has not seen the set.

| # | Expectation | Fails if |
|---|---|---|
| H1 | The new kernel catches more of the 40 than the old one on this same unseen set | new minus old is below 3 |
| H2 | The new kernel catches at least 26 of 40 | 25 or fewer |
| H3 | No wrong warning or error on the 10 decoys | 1 or more |
| H4 | At most 2 of the 40 twins draw a wrong warning or error | 3 or more |
| Guess | Old kernel: behaviour 10 to 12, structure 12 to 14. New kernel: behaviour 12 to 15, structure 13 to 15 | recorded as a guess only |

The seen sets, for the record and as a fix confirmation only: with the new checks the kernel flags 20 of 20 in
court 2 and 17 of 20 in court 2b (37 of 40, was 24 of 40). Still missed there: an index list with no final -1
(legal), the only object fully transparent, and an object 10,000 km from the origin.

## What this cannot show

Both authors are agents of the same model family as the kernel's rule writer, working in the same project. One
browser engine (X_ITE) is the witness. Twenty faults per set is a small sample: a difference of two or three catches
is within what a different author would move. A pass here is evidence that the kernel generalises a little beyond
the faults it was written from; it is not a rate.
