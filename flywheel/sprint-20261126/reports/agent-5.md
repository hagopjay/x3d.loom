# Gate policy proposal: evidence from 600 scenes

**Sample (C).** 600 distinct-text .x3d files (md5 dedupe) of 2,122 under /home/user (no .git, node_modules, files over 2 MB). Round-robin over 16 repos with a seeded shuffle (6 to 81 each); 9 files timed out or crashed and were skipped. Pass took 35 s. Table: counts.json. The sample includes test fixtures and adversarial probes, which inflate defect rates (L).

**Baseline (C).** 110 of 600 scenes already fail on an error (79 profile-component). 82 carry a warning; 63 of those are warning-only and pass today.

**Judgements (L).** 2 to 4 files read per check, judged from the diagnostic text, context and greps; nothing rendered. T/S/F = true defect / harmless style / false alarm.

| check | now | scenes | T/S/F | tier |
|---|---|---|---|---|
| orientation-half-turn-step | warn | 8 | 4/0/0 (pi minus 3.6e-9; 32-bit engines may reverse) | waivable |
| orientation-step-long-way | warn | 6 | 4/0/0 (half turn runs backwards) | waivable |
| orientation-never-turns | warn | 5 | 4/0/0 (2pi spin plays as nothing) | waivable |
| naming-convention | warn | 21 | 0/4/0 | advisory |
| empty-group | warn | 13 | 0/4/0 (hit proxies, empty tiles) | advisory |
| rotation-axis-not-unit | warn | 8 | 2/2/0 | waivable |
| mesh-zero-area-face | warn | 8 | 1/3/0 (one scene: all 12150 faces flat) | waivable if over half the faces, else advisory |
| route-fan-in | warn | 5 | 0/3/1 | advisory |
| mfstring-unquoted | warn | 4 | 0/4/0 | advisory |
| hanim-joint-name | warn | 4 | 2/2/0 (1.x names unbind motions) | waivable |
| shape-no-geometry | warn | 3 | 1/2/0 (16 empty shapes in an LLM scene) | waivable |
| interpolator-key-unreachable | warn | 2 | 0/0/2 (message says keys 0..1, fraction 0..1) | fix check, then advisory |
| route-never-fires | warn | 2 | 2/0/0 (probes) | waivable |
| scale-zero | warn | 2 | 0/2/0 (deliberate ROPE, 100 per scene) | advisory |
| mesh-non-manifold-edge | warn | 2 | 0/2/0 | advisory |

Thin reads: 0/4 means none seen, not none exist (L).

**Tiers.**
1. Blocks: all current errors (110 scenes).
2. Waivable with written reason: the three orientation checks, route-never-fires, hanim-joint-name, shape-no-geometry, rotation-axis-not-unit, zero-area faces above the majority threshold. Each changes what the viewer sees or what binds; fixes are cheap.
3. Advisory: the rest and all infos.

**Newly failing (C count, L policy).** Tier 2 with mesh-zero-area-face counted for all 8 scenes (upper bound): 32 of 600 (5.3%) newly fail unwaived; 39 carry a tier-2 warning in all. Orientation alone: 13. With the zero-area threshold, roughly 25 to 30 (S, not run). Many sit in fixtures and probes, so path-based waivers would cut the real-scene figure.

**Change first (L).**
1. orientation-half-turn-step to waivable (4/4 true; today's 41-scene problem).
2. orientation-step-long-way to waivable (4/4 true).
3. hanim-joint-name to waivable (silent loss of motion binding). Close alternative: orientation-never-turns, 4/4 true.

**Risks.**
- interpolator-key-unreachable looks like a false alarm; promote nothing until fixed. On Downey 7 of 12 new rules were false alarms (S, memory note), so run a corpus pass before each promotion.
- Waivers can become rubber stamps: store the reason in the receipt and expire it when the check changes.
- Fixtures skew rates; real-scene newly-failing is probably under 5%.
- The Loom meaning gate reads only errors (S, memory note), so tiers need a gate change, not just a level change.
