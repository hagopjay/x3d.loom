# Flop Lab: Giggleworks Carnival, stunt chains and inspectable X3D play

The supplied physics museum now has a focused slapstick play loop: jump, go
limp, steer with limited puffs, combine tricks, then recover to bank the show.
A new six-station Carnival makes familiar physics mechanisms approachable;
seven open prompts and nine stickers encourage different routes and mishaps.
The existing six Expeditions and four earlier worlds remain available.

## Resulting behavior

- Add a fixed-tick Show observer, variety multipliers, bounded repeated trick
  awards, session totals, crowd response, seven prompts and nine stickers.
- Add three directional ragdoll puffs per new flop, 0.35 s cooldown, with a
  normalized common 6 m/s velocity change. Recovery may bank midair and another
  flop reloads puffs intentionally. This is an open arcade toy, not a leaderboard.
  An actually applied puff marks an active legacy Expedition challenge practice.
- Add seeded Giggleworks Carnival from existing X3D prefabs: Giggle School,
  Biscuit Bowling, Sky Noodles, Jelly Department, Fan Club and Confetti Cannon.
  Its source contains 100 bodies/121 joints; all four older exports are unchanged.
- Add comic captions, bounded confetti, expressive cosmetic outfits and local
  synthesized effects. Audio requires explicit opt-in. Remove inherited automatic
  beeps; honor OS/manual reduced motion and clean up paused/background effects.
- Keep source editing, validation, inspection, offline Three runtime, Canvas
  fallback and pose-review boundaries. Generalize curator facts to the actual
  current course. Fix fractional-goal bars/labels for 0.35 and 0.8 objectives.
- Add a deep Stunt Playbook, independent audit, release evidence and portable
  lessons. Extend physics playbook patterns to 32 and failure modes to 182.
  No new Loom law or formal acceptance claim is introduced.

## Executed validation

Twelve Node suites cover original kernel/Expedition/codec behavior plus the new
Show controller, actual-Sim traces, Carnival routes and presentation isolation.
The inherited 12 physical gates and six Node negative controls remain passing.
Current source identities and exact outputs are in `receipts/showtime-checks.json`.
Five actual X3D exports pass pinned XSD/implemented semantic checks, with two
paired negative controls. Both patch bases are separately application-checked
in the delivery kit against the final Git tree.

Direct live browser checks observe software-rendered 3D, the playable Canvas
fallback, comic feedback, actual puff inputs/recovery banking, practice status,
audio opt-in state, reduced motion/outfits, prompt selection, native XML import,
a narrow layout and the guide. No fresh hardware-GPU, cross-host, actual gamepad/
touch-device, subjective listening/amusement or formal Loom result is claimed.
See `../VALIDATION.md` for exact scopes and remaining measurements.

## Patch bases and publication

The complete patch includes the original supplied fold-back, the prior Expedition
extension and this Showtime extension. It targets upstream commit
`be7c4816e41b04af1552a3f3bf8585fe2625057b` in `hagopjay/x3d.loom`.
The kit also contains an upgrade from the attached-source reconstruction
`3339f7f158e30bb3df8eddfca6b2019de1e7172d` and a Showtime-only update from
`c9d14e0bf9f411e7de0c78d2d283f9453c62c8a6`.

No remote branch or pull request was created. The workspace GitHub connector
was administrator-disabled and the CLI was unauthenticated; this is a complete
reviewable PR draft with exact-base patches and application instructions.
