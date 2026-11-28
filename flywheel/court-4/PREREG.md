# Blind court 4: written down before the seal is opened

28 November 2026. This file is committed and pushed before anyone who edits the kernel has read the test set.
It says what was sealed, which kernel is frozen, how a catch is counted, and what we expect. The results page
beside it is written afterwards and may not change this one.

## Why a fourth court

Court 3 (`flywheel/court-3`) gave the kernel its only clean before-and-after on an unseen set: 19 to 25 of 40. Its
15 misses were then read and turned into checks, so court 3 is now seen and any score on it is a fix confirmation.
The question this court asks is the same one, one turn later: do checks written from the last court's misses catch
faults in a set nobody on the kernel side has seen? The target told to the project owner beforehand was 30 of 40.

## What is sealed

Two authors, each a fresh agent that was forbidden to read any repository, memory or earlier test set, with only the
public X3D 4.0 XSD and X_ITE 16.8.0 to hand. Each wrote 20 planted faults, a corrected twin for every fault, and 5
legal decoys. The briefs are `brief-author-a.txt` and `brief-author-b.txt` (paths shortened to `WORK`); they are the
court 3 briefs with three changes, listed below.

| Set | Author's brief | Files | Archive sha256 | Sealed (UTC) |
|---|---|---|---|---|
| A behaviour | what a scene does over time or on interaction | 20 faults, 20 twins, 5 decoys | `f774cbf9287078a6da7131c41066e2ee7195bc8cab782f8f469bdeacff1afd92` | 03:13:11 |
| B structure and data | a static scene that is wrong | 20 faults, 20 twins, 5 decoys | `25615daec2450fbaec693a36b93579eca2eb171de7c2117182a4d3f2570af174` | 03:14:05 |

Authors' own counts, not yet checked by us: set A has 1 schema-invalid fault, 20 of 20 pairs witnessed in X_ITE, 1
pair where the browser disagreed with the author; set B has 2 schema-invalid faults, 20 of 20 pairs witnessed, 0
disagreements. All 10 decoys loaded with no console error (X_ITE 16.8.0, Chromium 158.0.8127.36 headless, ANGLE on
SwiftShader, Playwright 1.63.0, Python 3.13.18, lxml 6.1.3, Node 22.23.5).

Three changes from court 3, each closing something court 3 reported:

1. **A fixed report form.** Court 3's authors named topics in their closing reports. This time the report is a form
   of counts, a hash and tool versions. Both authors returned exactly the form. Nothing about the content of either
   set has reached the kernel editor.
2. **The whole X_ITE distribution.** Court 3's kit lacked the component files, so both authors fell back to
   `profile='Interchange'` and drew ten component complaints that were not about any planted mistake. This kit has
   every component file (npm `x_ite@16.8.0`, tarball sha256 `8a8dc926c2ea…7275288b`), and the brief asks for the
   profile and components each scene really needs.
3. **A sibling rule in both briefs.** Each author was told not to read the other's folder.

## What is frozen

| Kernel | Commit | What it is |
|---|---|---|
| Old | x3d_mcp `ca0e75c` (main) | Court 3's new kernel plus two later merges that are not about these faults (the opt-in SimReady profile, and a naming-convention fix) |
| New | x3d_mcp `c185673` | Old plus `src/validation/plays_checks.py`: 20 checks, registered in `data_checks.py` |

The 20 new checks are of two kinds, and the results page says which kind made each gain:

- **13 written from court 3's misses**: a clock whose one cycle ended in 1970, drag limits swapped, a damper or
  chaser that smooths nothing, a Script input with no function of its name, a LoadSensor watching something that
  never loads, an Anchor to a viewpoint that is not there, LOD levels that can never be picked, a closed mesh wound
  inside out, a ProtoInstance field its prototype does not declare, a crossSection that crosses itself, NURBS knots
  the browser discards, a lit scene with the headlight off and no light, and a BooleanToggle that starts out of
  step with the field it drives. Two of the 15 misses were left out because only the author's intent decides them
  (which StringSensor output feeds a label; which Viewpoint comes first).
- **7 from the editor's own list**, written from no test set: a Switch with no whichChoice, a dented face declared
  convex, a flat patch facing away from every viewpoint (a note, not a warning), a scoped light with nothing in its
  scope, a clock stopped or paused in 1970, a fully transparent shape, and a first Viewpoint with all the geometry
  behind it.

Source hashes at the freeze (sha256): `plays_checks.py` `5c724333ff8a…5adeeb4`, `inert_checks.py`
`e1a568f0e75e…d790814`, `data_checks.py` `ad36e2c3e560…0c0ca4c8`, `semantic.py` `93d55e598fc7…3ecc1302`. Nothing under
`src/` changes between this file and the scoring run; the results page prints the hashes again. The new kernel's
own suite: 2083 passed, 27 skipped, 1 xfailed (pytest, Python 3.13).

The seen sets, for the record and as a fix confirmation only: on court 3 the 20 checks add a finding on 13 of the
15 faults that were missed (editor's reading, not judged by a second reader) and one warning on a decoy, which is
right: that decoy's first crate is wound inside out and only its mirrored copy is drawn correctly.

Before the freeze the 20 checks were run over 1,523 real scenes in x3d.loom and x3d.demo and narrowed where they
were noisy (a written `whichChoice='-1'` is left alone; a face that is not flat is not judged for dents; a
shader-drawn Shape needs no light). That sweep read no part of the sealed set.

## How a catch is counted

The same script runs both kernels on all 90 files once and saves every diagnostic (`score/run_kernel.py`, the court
3 runner). `score/build_packet.py` merges the two runs for the second reader; `score/score.py` prints the count. All
three are in this commit, written before the seal is opened.

- **Caught (the rule courts 2, 2b and 3 used):** the file fails the X3D 4.0 XSD, or at least one diagnostic at any
  level names the planted mistake.
- **Caught, strict:** the file fails the XSD, or a diagnostic at warning or error level names the planted mistake.
- **Who decides "names the planted mistake":** two readers, separately. One is a fresh agent that has not read
  the kernel and is given only the manifests and the diagnostics, without being told which kernel said what. The
  other is the kernel editor, whose file is written first. The fresh reader's count is the headline; the editor's
  count and every disagreement are printed beside it.
- **Faults stay in the denominator** even when the author's own witness says the browser disagreed, and even when
  the second reader does not call the fault real. Scores without those faults are printed beside the headline.
- **False alarms:** any warning or error on a twin or a decoy is a flag (50 legal files). Each flag is judged right
  (the file really has that problem) or wrong.
- **Notes count too.** One new check is only a note, and a note that names a fault counts as a catch under the
  rule above. So that a noisy note cannot buy a catch for free, the second reader also judges every finding of the
  20 new checks on the 50 legal files at any level, and H5 below sets a limit.
- **Repeats of court 3.** The authors are of the same model family as court 3's and had the same brief, so some
  faults may repeat a court 3 fault, and the 13 checks were written from exactly those. The second reader is given
  the 40 planted mistakes of court 3 and marks each court 4 fault that is the same mistake on the same kind of node.
  The score is printed with and without the repeats.
- **One run.** No check is changed and the set is not rescored after it is opened. After the results are written
  the set is seen, and joins courts 2, 2b and 3 as a regression set.

## What we expect

Written by the kernel editor, who has not seen the set.

| # | Expectation | Fails if |
|---|---|---|
| H1 | The new kernel catches more of the 40 than the old one on this same unseen set | new minus old is below 3 |
| H2 | The new kernel catches at least 30 of 40 (the target told to the owner) | 29 or fewer |
| H3 | No wrong warning or error from the new kernel on the 10 decoys | 1 or more decoys |
| H4 | At most 2 of the 40 twins draw a wrong warning or error from the new kernel | 3 or more twins |
| H5 | The 20 new checks make at most 2 wrong findings, at any level, on the 50 legal files | 3 or more |
| Guess | Old kernel: behaviour 10 to 13, structure 12 to 15. New kernel: behaviour 12 to 16, structure 14 to 17 | recorded as a guess only |

The editor's honest guess for the new kernel is 27 to 31 of 40, so H2 is more likely to fail than to hold. It
stays at 30 because that is the number that was promised before any of this was run.

## What this cannot show

Both authors are agents of the same model family as the kernel's rule writer and as court 3's authors, working in
the same project with the same brief: a new set by the same kind of author is a weaker test than a set by a
stranger, and the repeats column measures part of that. One browser engine (X_ITE) is the witness. Twenty faults
per set is a small sample: a difference of two or three catches is within what a different author would move. A
pass here is evidence that the kernel generalises a little beyond the faults it was written from; it is not a rate.
