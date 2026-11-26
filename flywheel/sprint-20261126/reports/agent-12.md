# Agent 12: blind reclassification of 30 of 170 glTF-Validator codes

**Caveat.** I am an AI of the same family as the claimant's rule writer. "Blind" only means I had not read its classification. Shared training means shared blind spots, so this is a second opinion, not an audit.

## Method
I classified the 30 seeded-random codes from my own knowledge (S stateable, B bytes, D design, F feature) and saved the table to blind.md. Only then did I open the KEY. Stateable means the project's new, existing, xsd or semantic. Not stateable means binary, design or feature.

## Result
- **Binary agreement: 26 of 30 (87%).** Disagreement is 4 of 30 (13%).
- Project stateable 15, not stateable 15.
- Finer class: where we agreed on not stateable, the label differed twice (NODE_WEIGHTS_INVALID F vs design; MULTIPLE_EXTENSIONS D vs feature). My S calls fit new/xsd/semantic in every agreed case.

## Disagreements
| code | mine | theirs | verdict after argument |
|---|---|---|---|
| MESH_PRIMITIVE_NO_TANGENT_SPACE | D | new | Lean mine. X3D has no tangent field, so the mistake cannot be written. A normal map without tangents is legal X3D, and the project's own note says "information not error". |
| UNSUPPORTED_EXTENSION | S (low) | feature | Project right. The code reports the validator's own limits, not a file mistake. |
| ANIMATION_CHANNEL_TARGET_NODE_WEIGHTS_NO_MORPHS | F | semantic (`route-invalid-to-field`) | Mine is stronger. X3D 4.0 has no morph weights. A ROUTE to a missing field is a different, generic error that the check happens to cover. |
| NODE_SKIN_NO_SCENE | D | new (`hanim-joint-outside-skeleton`) | Unclear, leaning mine. The HAnim error is real, but it is not clearly the same mistake. |

## Direction of bias
Three of the four disagreements go one way. The project counts a nearby X3D check as covering a glTF code where I see no true counterpart. That makes the 88 larger and "88 of 88" easier to reach. The only reverse case, UNSUPPORTED_EXTENSION, I conceded. So no code would enlarge the denominator after argument. Caveats: n is small, and I judged material-extension codes against X3D 4.0. If the project's scope is 4.1 (my assumption), some F codes would move to S.

## Extrapolation (n = 30)
- Observed disagreement is 4/30 = 13%, Wilson 95% interval about 5% to 30%.
- Project stateable that I called not stateable: 3 of 15 (20%, interval roughly 7% to 45%). Project not stateable that I called S: 1 of 15 before argument, about 0 after.
- If my reading holds, perhaps 15% of the 88 are loose analogues, so about 75 codes have a true counterpart (plausible range 60 to 88). The denominator itself would not grow. At most about 5 of the 82 could move up if my one S call generalised, and probably none.

## Suggested honest headline
"The validator has a check for each of the 88 glTF-Validator codes the project judged stateable in X3D, out of 170. A blind re-check of 30 codes matched 26 of the project's calls. The disagreements were mostly loose analogues, so the count with a true counterpart may be nearer 75."

Files: agents/12/blind.md and REPORT.md.
