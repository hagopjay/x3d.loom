# Blind court 5: pre-registration (DRAFT, not binding)

This is the form. At gate G4 every `TO FILL` is completed, the file is renamed `PREREG.md`, and it is committed
and pushed with the frozen kernel before any archive is opened. Until then nothing here is a commitment, and
`PLAN.md` may still change. After the rename, neither may.

## What is sealed

| Set | Brief | Files | Archive sha256 | Sealed (UTC) |
|---|---|---|---|---|
| a | behaviour | TO FILL | TO FILL | TO FILL |
| b | structure and data | TO FILL | TO FILL | TO FILL |
| c | look | TO FILL | TO FILL | TO FILL |
| s | stranger arm | TO FILL, or "empty" with the reason | | |

Authors' own counts from the fixed form, not yet checked: TO FILL. Anything an author's report said beyond the
form: TO FILL, or "nothing".

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

Forecast, a guess and labelled as one: old kernel TO FILL to TO FILL of TO FILL new mistakes; new kernel TO FILL
to TO FILL. The grid's own prediction (share of probed, file-stateable cells the frozen kernel closes): TO FILL.

## What this cannot show

As `PLAN.md`, last section, plus anything learned between now and the freeze: TO FILL.
