# Learnings: Fault Court (26 Nov 2026)

Lane: the X3D flywheel plan, test T2 (does X3D hold an AI to account better than glTF and USD?), with a T4-style Loom arm. The owner picked "T2 with elements of T4". Kit and results: `fault-court/`. Failure modes 318 to 322.

## Numbers (C; x3d_mcp 4d433af, glTF-Validator 2.0.0-dev.3.10, usd-core 26.11 with 30 UsdValidation validators)

- **Faults the format can state (of 60):** X3D 53, glTF 48, USD 44.
- **Caught by the format's own checkers:** X3D 39 of 53, glTF 46 of 48, USD 5 of 44.
- **Paired comparisons:**
  - X3D vs glTF on 43 faults: 29 vs 41 (p = 0.0005), so **H1 fails**.
  - X3D vs USD on 39 faults: 26 vs 5, so **H1 passes**.
- **Loom rules from the learn half, scored on the held-out half:**
  - X3D: 17 to 20 of 25.
  - USD: 1 to 10 of 20.
  - glTF: 23 to 23 of 24.
  - No false alarms on the decoys.

## Lessons

1. **Schema validity is not data validity.** X3D's misses are cross-field (array counts), file-level (texture missing or not an image), graph-level (a USE cycle) and declared-vs-actual (bounds). glTF-Validator checks all of these. To make "X3D is the format an AI can be held accountable to" true, the X3D validator needs a data layer (FM 318).
2. **Check every planted value against each format's sentinels.** X3D's -1 means "automatic" (FM 319).
3. **Score the reason as well as the catch** (FM 320).
4. **USD's validators are about structure, not values** (FM 321).
5. **Name where each catch came from** (FM 322).
6. **The flywheel turns, measurably.** Rules learned from half the mistakes caught mistakes they had never seen, with zero false alarms. Upstreaming R1 to R5 into the x3d_mcp fork is the next turn.
