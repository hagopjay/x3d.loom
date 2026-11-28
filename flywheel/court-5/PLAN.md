# Blind court 5: the standing plan

28 November 2026. Asked for by the project owner: "do we have and can we strengthen fortify the strategy for
closing the gap properly, scientifically without tricks", then "pls continue with specifyin and scaffolding Court
5's standing plan". This file is the plan. It is not a pre-registration: no set is sealed and no kernel is frozen
yet. `PREREG-DRAFT.md` is the form that becomes binding at the freeze. Everything in the folder beside this file
is scaffold that has been run once on a dummy set (`dry-run/`), and nothing here is a result.

## The gap, in the numbers we already have

| Court | Sealed set | Old kernel | New kernel | Source |
|---|---|---|---|---|
| 3 | 40 faults, 2 authors | 19 (x3d_mcp `ebe969b`) | 25 (`d647a10`) | `flywheel/court-3/RESULTS.md` |
| 4 | 40 faults, 2 authors | 19 (`ca0e75c`) | 23 (`c185673`) | `flywheel/court-4/RESULTS.md` |
| 4, the 19 faults that repeat court 3 | | 16 | 18 | same, second reader's repeat marking |
| 4, the 21 new mistakes | | 3 | 5 | same |

Court 4's 13 checks written from court 3's misses gained 2 faults, both repeats. Its 7 checks written from the
editor's own list, with no test set, gained the only 2 on new mistakes. Of the 17 faults the new kernel missed,
the editor's reading is that 9 can be stated from the file and 8 need what the author meant.

So the gap has three parts, and each needs its own instrument:

1. **Repeats inflate the score.** A kernel that has seen a mistake names it next time. That is a fix confirmation.
2. **Rules written from misses do not travel.** They fit the last set.
3. **Some faults are not in the file.** Only intent decides them.

## The five changes, ranked

1. **The headline is new mistakes only.** Authors get the one-line list of all 120 earlier planted mistakes
   (`prior/prior-mistakes.txt`, built by `prior/build_prior.py` from the four opened answer keys) and are told to
   plant none again. The second reader still marks repeats, and repeats are scored beside the headline, never in
   it. The number to stand beside is court 4's 5 of 21.
2. **Rules come from the standard's object model, not from the last set.** `grid/build_grid.py` reads X3DUOM 4.0
   (sha256 `7e426a238656c21a…`, the copy in x3d_mcp) and lists every place where one of 15 classes of mistake can
   occur: 6,434 cells over 260 nodes (`grid/grid.json`). A cell is closed by a probe pair, a wrong file and its
   corrected twin made mechanically, on which the kernel names the mistake and stays silent on the twin. Every
   check the new kernel adds is labelled `grid` or `misses` in `provenance.json` at the freeze, and the scorer
   prints which label made each gain.
3. **Stated intent is its own arm.** A scene may say what it is for in lines a machine can test
   (`intent/INTENT.md`). A headless play test (`play/play.mjs`, X_ITE) loads the scene, sends the stimuli and
   checks each assertion. The kernel never sees the intent; the play score is never added to the kernel score.
4. **A stricter catch rule, checked by machine.** A catch is *proven* only when the evidence is absent on the
   corrected twin (below). On court 4 this changes nothing (`baseline/court4_proven.py`: still 19 to 23, and 3 to
   5 on new mistakes), so it costs no comparability and closes a door.
5. **A set by a stranger.** Everything so far was written by agents of one model family in one project. A slot is
   reserved for a set from outside (below). It is the weakest point of every court so far and the one this plan
   cannot close alone.

## Arms

| Arm | What is tested | Instrument | Who decides a catch |
|---|---|---|---|
| F, file only (headline) | scenes with every intent line removed | old and new kernel, XSD | second reader names it, machine proves it against the twin |
| I, intent | the same scenes with intent lines | play test in X_ITE | machine only: an assertion fails on the fault and all hold on the twin |
| S, stranger | a set from outside this model family | as arm F | as arm F; reported apart, never pooled |

Sixty faults in arm F: three authors, 20 faults, 20 twins and 5 decoys each (`briefs/author.txt`,
`briefs/categories.txt`: behaviour, structure and data, look). The third brief is new and was fixed here, before
any kernel work for this court.

## How a catch is counted

- **Named** (the rule of courts 2 to 4, still printed): the file fails the X3D 4.0 XSD, or the second reader says
  a diagnostic at any level names the planted mistake.
- **Proven** (court 5's headline rule): named, and the twin passes the XSD, and the check that names the mistake
  fires more often on the fault than on its twin, for the same kernel. `score/score.py` computes it; no judgement
  is involved in the second half.
- Faults stay in the denominator whatever the reader or the witness engine says about them. Scores without the
  faults the reader does not call real are printed beside.
- Old against new is a paired comparison on the same files: the script prints gained, lost and the exact
  two-sided sign test. For scale: six gained and none lost gives p = 0.031; five and none gives 0.063.
- False alarms: every warning or error on the 75 legal files is judged by the second reader; every finding of a
  new check on a legal file is judged at any level.
- Both kernels are given the scene's folder (`semantic_diagnostics_with_files`), so an address that finds no file
  can be seen. Court 4 ran on the text alone and missed one for that reason.
- One run. Nothing is rescored.

## How a target is set

Court 3's target was missed by one and court 4's by seven; both were hopes. This court promises no number. The
pre-registration records three things instead: a direction test (new beats old on new mistakes, none lost), the
like-for-like figure from court 4 (5 of 21, 24%), and the editor's forecast as a range, labelled a guess. The grid
adds one honest predictor: the share of probed cells the frozen kernel closes is written down before the seal is
opened, and the results page says how well it predicted.

## Tricks this court may not use

1. Rescoring, or changing a check, a script or the catch rule after the seal is opened. Any script edit forced by
   a crash is disclosed with its diff, as in court 4.
2. Dropping a fault from the denominator.
3. Counting a repeat in the headline, or quoting the all-faults score without the new-mistakes score beside it.
4. Counting a general note that fires whatever the mistake was (the unused-DEF note). The proven rule removes the
   ones that also fire on the twin; the reader's brief removes the rest.
5. A check keyed to a file name, an author's habit, a DEF name or a comment. Checks read the scene graph only.
6. Adding the intent arm to the kernel score, or letting the kernel read intent lines.
7. An intent line that states the answer. The reader marks them and the score is printed without them.
8. Comparing a score on one set with a score on another as if they were the same test.
9. Quoting a count of grid cells as coverage of X3D. It is coverage of this grid.
10. A rule writer, or the editor, reading any part of a sealed set, an author's notes or an author's report beyond
    the fixed form.
11. Setting a target after seeing any score, or moving one.
12. Calling a seen set held-out. After the results are written, court 5 joins courts 2, 2b, 3 and 4 as a
    regression set.

The seven process leaks the meta-review named (P1 stale inputs, P2 rule after test, P3 judge blindness, P4 chosen
denominators, P5 prose outruns receipt, P6 one author family and engine, P7 inflated counts) each have a control
above or a gate below, except P6, which only arm S addresses.

## Gates

| Gate | Done when | State |
|---|---|---|
| G0 plan | this folder is merged | this pull request |
| G1 kernel turn | grid probed class by class, checks written, each labelled in `provenance.json`; the nine file-stateable court 4 misses handled as `misses` | not started; `grid/probe.py` is not written yet |
| G2 dry run | `dry-run/run.sh` passes on the frozen scripts with the frozen kernel | passes today on the scaffold (old `ebe969b`, new `2943b78`, X_ITE 16.8.0) |
| G3 seal | three fresh authors, forbidden every repository and memory, return the fixed form and a hash | needs the owner's go |
| G4 freeze | kernel commit and `PREREG.md` pushed before any archive is opened | |
| G5 open | intent stripped, both kernels run once, play test run once | |
| G6 read | a fresh second reader, blind to which kernel said what, and the editor's reading written first | |
| G7 results | `RESULTS.md`, ledger turn, fold-back to x3d.docs | |
| G8 retire | the set is marked seen | |

## The stranger arm: open, and the owner's choice

Ranked by how much independence each buys.

1. **Dr Polys's sealed tasks.** A person outside the project writes the faults. Held: nothing goes out before
   December and before the owner's "send".
2. **Mistakes people really made.** Faults rebuilt from public bug reports and forum threads about X3D tools, each
   with a link, attribution and a takedown notice. No author chooses them, so no author's habits are in them. It
   reads public pages and sends nothing; it needs the owner's yes because it uses outside material.
3. **Another model family as author.** Independent of this family's favourite mistakes, not of machine authorship.
   Needs a spending decision.
4. **The owner or a colleague writes ten by hand.**

Without one of these, court 5 runs arms F and I and says in its first paragraph that arm S is empty.

## What court 5 cannot show, even if everything goes well

A higher score on new mistakes by same-family authors shows the kernel generalises beyond the mistakes it has
seen, among mistakes this family thinks of. It is not a rate for X3D in the wild. Sixty faults is still a small
sample. One engine (X_ITE) is the witness and the play test. The grid holds only classes the object model can
enumerate; a mistake outside all 15 classes is invisible to it. The intent arm tests fields, not pixels, and its
authors write both the scene and the statement of what it is for.

## Files

| Path | What | Run today |
|---|---|---|
| `PLAN.md` | this plan | |
| `PREREG-DRAFT.md` | the form to complete and rename at the freeze | |
| `prior/build_prior.py`, `prior-mistakes.json`, `prior-mistakes.txt` | the 120 earlier planted mistakes, one line each | yes |
| `grid/classes.json`, `grid/build_grid.py`, `grid/grid.json` | 15 classes, the builder, 6,434 cells, all `unprobed` | yes |
| `intent/INTENT.md`, `intent/strip_intent.py` | the intent form, and the tool that removes it for the kernel | yes |
| `play/play.mjs` | the headless play test | yes |
| `briefs/author.txt`, `briefs/categories.txt`, `briefs/reader.txt` | what the authors and the second reader will be told | |
| `score/run_kernel.py`, `build_packet.py`, `score.py` | runner, the reader's packet, the count | yes |
| `baseline/court4_proven.py`, `court4-proven.json` | court 4 under the proven rule | yes |
| `dry-run/` | a dummy set of 4 faults with a helper file, a stand-in reader, `run.sh`, and the output it gave (`expected-results.json`) | yes, passes |

To rerun the dry run: `flywheel/court-5/dry-run/run.sh <old x3d_mcp> <new x3d_mcp> <x_ite dist> <work dir>`.
