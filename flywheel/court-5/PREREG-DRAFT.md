# Blind court 5: pre-registration (DRAFT, not binding)

This is the form. At gate G4 every `TO FILL` is completed, the file is renamed `PREREG.md`, and it is committed
and pushed with the frozen kernel before any archive is opened. Until then nothing here is a commitment, and
`PLAN.md` may still change. After the rename, neither may.

## What is sealed

| Set | Brief | Files | Archive sha256 | Sealed (UTC) |
|---|---|---|---|---|
| a | behaviour | 20 faults, 20 twins, 5 decoys, 2 helpers | `02d8c77133cde2124f87f35d45ffeb5ace1b8e6bf6964b00e3c8ca45da4f4ed8` | 28 Nov 2026, about 14:14 |
| b | structure and data | 20 faults, 20 twins, 5 decoys, 1 helper | `c448a7c46b918d9ca277f91a28ef7a8038399b89996840f9002e0fbc54569db5` | 28 Nov 2026, about 14:05 |
| c | look | 20 faults, 20 twins, 5 decoys, 3 helpers | `bf62b8a3e035db0ff5ce45f8bda599519e7aa05150814d0121844bd18c2c7bcb` | 28 Nov 2026, about 14:07 |
| s | stranger arm: real mistakes rebuilt from public reports | 16 faults, 16 twins, 5 decoys, 1 helper | `74b80378310398856cead31a9d2a802aa8a7a1c7f7fe0e947e16ca4c56fa899b` | 28 Nov 2026, about 13:32 |

Authors' own counts from the fixed form, not yet checked:

| Set | Faults that fail the XSD | Pairs played in X_ITE 16.8.0 | Pairs reasoned only | Pairs with a testable intent | Decoys with zero console errors | Pairs where the engine disagreed |
|---|---|---|---|---|---|---|
| a | 0 | 20 | 0 | 14 | 5 of 5 | 1 |
| b | 4 | 20 | 0 | 2 | 5 of 5 | 2 |
| c | 3 | 18 | 2 | 3 | 5 of 5 | 1 |
| s | 1 | 16 | 0 | 4 | not on its form | 1 |

Anything an author's report said beyond the form: nothing. All four reported no blocker. All four used Python
3.13.18, lxml 6.1.3, Node 22.23.5, Playwright 1.63.0, Chromium 158.0.8127.36 and software GL (SwiftShader).

When the sets were sealed, x3d_mcp main stood at `15081e6`. The kernel is NOT frozen: rule work goes on until gate
G4, and no rule writer has opened any archive. The sets were written before the freeze on purpose, so that a
sealed hash older than the last rule shows the sets could not have been shaped by the rules, and the rules could
only have been shaped by the sets through a breach of blindness.

Known before opening, from the forms alone: the intent arm has 19 pairs of 60 in arm F (14 of them in set a) and 4
of 16 in arm S. It will be reported as counts, per set, and set a carries it.

## What is frozen

| Kernel | Commit | What it is |
|---|---|---|
| Old | x3d_mcp TO FILL | main before this court's kernel turn |
| New | x3d_mcp TO FILL | old plus the checks listed in `score/provenance.json` |

Checks added: TO FILL labelled `grid`, TO FILL labelled `misses`. Source hashes at the freeze: TO FILL. Kernel
suite: TO FILL. Scripts in this folder at commit TO FILL; `dry-run/run.sh` passed on them with the frozen kernel:
TO FILL.

Grid at the freeze (`grid/grid.json`): TO FILL cells probed of 6,434; of those TO FILL caught, TO FILL xsd, TO FILL
missed, TO FILL needs-intent, TO FILL not-a-mistake.

## How a catch is counted

As `PLAN.md` at this commit, sections "Arms" and "How a catch is counted". Headline: proven catches on the faults
the second reader marks as repeating none of the 120 earlier planted mistakes, arm F.

## What we expect

Written by the kernel editor, who has not seen the set.

| # | Expectation | Fails if |
|---|---|---|
| H1 | On new mistakes, the new kernel proves more than the old one and loses none | gained is 0, or lost is 1 or more |
| H2 | That difference is unlikely to be chance | the exact two-sided sign test gives p of 0.05 or more |
| H3 | No decoy draws a warning or error from the new kernel that the reader does not judge right | 1 or more decoys |
| H4 | At most 2 twins draw one | 3 or more twins |
| H5 | The new checks make at most 2 findings, at any level, on legal files that the reader does not judge right | 3 or more |
| H6 | Checks labelled `grid` make at least half of the headline gains | fewer than half |
| H7 | The play test catches at least half of the new faults that carry an assertion and that the new kernel missed | fewer than half |
| H8 | No twin or decoy fails its own intent in the play test | 1 or more |

Beside the headline, for scale only: court 4's new kernel proved 5 of 21 new mistakes (24%).

Warning carried from `grid/PROBE-RESULTS.md`: the grid's field-at-a-time classes were 97.4% closed before this
turn, while court 4's kernel named 5 of 21 new mistakes. Closing the grid is not a forecast of the score.

Forecast, a guess and labelled as one: old kernel TO FILL to TO FILL of TO FILL new mistakes; new kernel TO FILL
to TO FILL. The grid's own prediction (share of probed, file-stateable cells the frozen kernel closes): TO FILL.

## What this cannot show

As `PLAN.md`, last section, plus anything learned between now and the freeze: TO FILL.
