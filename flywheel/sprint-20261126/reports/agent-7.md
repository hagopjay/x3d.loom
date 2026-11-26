# Agent 7: hostile-but-fair review

Ranked most to least damaging. Files under x3d.loom unless noted.

1. **Self-defined denominators.** Claim: "88 of 88", "66 of 66", "52 of 53". Evidence: "Covered, of the mistakes X3D can state" (x3d_mcp docs/USD-VALIDATION-PARITY.md); really 66 of 340 and 88 of 170. The claimant classifies "stateable" and writes the checks. Fatal as worded. Fix: lead with 88/170 and 66/340; an outsider blind-reclassifies 30 random codes.

2. **Fix confirmation as a turn.** flywheel/README.md: "Turn 2's Fault Court number is a fix confirmation, not a prediction. The checks were written by someone who had seen all 60 faults." The ledger still headlines 39 to 52 of 53; the only held-out figure is the Loom arm, 17 to 20 of 25. Fatal for T2 as accountability evidence. Fix: sealed fault list, rules frozen first.

3. **The Lean analogy.** A kernel is sound for a formal system and checks a proof of a stated theorem. Here a decoy is flagged (LEDGER.md: "Decoys flagged 1 of 10"), and nothing says what a passing file proves. The plan concedes "appearance not decidable", "28 executable rules of 314 FMs", "receipts unsigned". Needs rewording. Surviving claim: a deterministic, versioned, rerunnable checker with a public ledger of its misses.

4. **"No model, no person" versus an agent writing rules.** selfcode-loop.md: "METHOD: no model, no person." flywheel/README.md: rules "written by an agent in a working session with a person present... 'turns without a person' is still 0." True of the search only; rule writing is the flywheel's hinge. Needs rewording.

5. **Self-coding tasks share the method's author.** selfcode/PREREG.md: "The tasks and the method have one author." H1 87/90 and H4 p = 2.9e-12 rest on synthetic tasks judged by the project's own simulator, which the search exploited (FM 338). The p-value measures task regularity. Needs rewording; sealed tasks from Polys fix it.

6. **Wild set: thresholds failed, headline stays 74%.** selfcode-loop.md: "W3b, W4 FAILED"; 47 of 100 excluded, 50 of 53 tasks are animation, 2 of 11 large scenes rebuilt; wild/PREREG.md: scenes "not independent of each other". Needs rewording: "39 of the 53 small, animation-dominated scenes that survived exclusion".

7. **Browser court: one engine, judge changed after failures.** wild/COURT.md run 3: 25 same, 1 differs, 9 unclear, 4 tool errors of 39 against "at least 30 ... fail"; runs 1 and 2 also failed, the judge was rewritten, and "10 of 12" was counted "after the fact". X_ITE 16.8.1 only, software GL. Needs an experiment: a second engine on all 39, on a quiet machine.

8. **Corrected counts; rule validated on the files that suggested it; own-family corpora.** rules-from-findings/README.md: "136 of 443" became 41 of 463; the first draft "flagged 10" false alarms; "One project's files... Not a rate for X3D at large." The rule came from FM 357/361/451, then was scored on the same repositories; "8 of 8" is one engine. Turn 3 found 9 false files fixtures missed (FM 364). The false-alarm rate on real X3D is unknown. Needs an experiment: freeze, then run on the 401-scene reserve and Web3D example archives.

9. **Why X3D and not glTF or USD?** Fault Court H1 failed against glTF (29 vs 41, p = .0005; glTF-Validator caught 46 of 48) and was reversed only by the confirmed rewrite. USD plus a rule-writer could make the identical claim. Turn 4: "17 X3D only" pairs arose because Blender repaired the fault (FM 372, "the importer launders faults"). Needs rewording to "can be held to account comparably", plus the same turn run on glTF.

## Three sentences to rewrite first
1. "88 of 88" (ledger, parity doc). Proposed: "The validator reports 88 of the 170 Khronos glTF codes; 46 concern byte layout, 21 have no place in X3D, and 12 name features X3D 4.0 lacks."
2. "METHOD: no model, no person." Proposed: "The search made no model calls; its rules and checks were written by Claude with the owner present."
3. The self-coding headline. Proposed: "On 90 tasks written by the method's author, judged by the author's simulator, 87 were solved (regression, not generality). On real scenes, 39 of the 53 that survived exclusion were rebuilt."

## The one experiment
A sealed replication: freeze x3d_mcp; outside authors (Polys's students) who have not seen the rules write 60+ faults, decoys and clean files for X3D, glTF and USD; score all three validators on one preregistered denominator with false alarms; replay a random sample in two engines. Publish failures.
