# Independent Showtime integration audit

This audit exercises the new arcade judge against the actual unchanged Sim,
with source inspection for the live-app boundary. It does not measure whether
people laugh, finish a route, like a sound, or find the timing comfortable.
Those questions need live playtests. No renderer, audio device or browser was
invoked by this test program.

## Executed controls

`node test/showtime-integration.test.mjs` passes eight integration controls.
The command prints a JSON record containing executor, consumed source hashes,
observations and input/pose-trace hashes; the release runner can retain that
stdout alongside the other checks.

| Control | Actual observation and changed-state twin |
|---|---|
| Neutral observation | All 300 stock-course pose fingerprints agree tick by tick with a Sim that has no Showtime hooks; source JSON is unchanged |
| Puff legality and impulse | A grounded hero's request refuses. A live ragdoll receives the same finite velocity increment on all eleven active bodies; the disabled hero and source JSON remain unchanged. A duplicate/cooldown request refuses |
| Per-flop charge cap | Continuous requests over 100 actual airborne ticks accept exactly three puffs and leave zero charges |
| Same-host input repetition | Two 150-tick puff traces agree at every pose; a disabled-puff twin differs on 148 ticks |
| Ordinary complete interaction | From the stock spawn, jump, flop, use three upward puffs and recover: 510 toy style points banked, with the three-puff sticker earned |
| Recovery versus death | A real observed airborne chain banks 310 points on recovery; observing the same physical frame ten more times pays nothing. Its respawned twin banks zero and loses pending score |
| Run lifecycle | Replacing a run preserves earned session bank/best but drops pending score. Attaching a new judge to an actual Sim with an already finished stunt does not pay that old result |
| App review boundary | The extracted actual app `tick()` returns during pose review before accessing a sentinel Sim getter. The live-path control reaches and trips that same sentinel, demonstrating that the review guard distinguishes the paths |

The last control uses an actual application function with a sentinel adapter.
It is not full app initialization or a browser test. The puff-mechanics controls
use a declared high-altitude pose to isolate the ability; they do not present
that pose as normal course completion.

The ordinary stock-spawn trace has no teleport or manual pose initialization:
settle 40 ticks, jump on tick 41, flop on tick 46, request upward puffs on ticks
48, 72 and 96, then recover on tick 116. It banks 1.167 seconds of observed limp
airtime, three puff tricks and one air family, for three distinct families and
a ×2 authored multiplier. This demonstrates one attainable loop in the local
fixed-step engine. It is not a browser latency measurement or a human success
rate.

## Findings and semantics to preserve

No correctness defect was found by these eight controls. Source review also
identified an avoidable per-tick allocation in the contact-presence query;
the implementation owner was advised to scan and break directly instead of
building a temporary array of every contact. That is an allocation observation,
not a measured frame-rate regression or improvement.

Recovery is the banking event, including pressing F while airborne. A chain
does not require landing on the floor to pay. Multiplier and unbanked progress
belong to one flop; death drops them. Showtime's cumulative bank, best stunt,
stickers and prompt history belong to the current page session and can survive
course/mission rebuilds. They are authored local toys, not comparable results
across different models or an externally verified leaderboard.

Three puffs are available per new flop. Recovering, flopping again and repeating
can therefore extend flight indefinitely by design. The per-flop cap does not
claim a finite fuel tank across the entire session. The application marks an
original Expedition challenge as practice when an actual puff fires, keeping
the old medal route distinct from the assisted toy score.

The judge reads live contacts, events and zones. It does not alter the physical
solver or serialize a full checkpoint. A source edit can still alter what the
judge sees, and custom solver code runs in the page's trust context; neither the
arcade judge nor its session best is an anti-cheat boundary.

## High-value follow-up measurements

- Observe first-time players reaching the first bank and understanding Q/F.
- Compare display/input latency and effects under slow software rendering and
  ordinary hardware GPUs, preserving the same physical input trace.
- Check touch controls and real gamepads rather than inferring them from a
  keyboard path.
- Review reduced-motion and audio-off play independently of the most exuberant
  presentation.
- Before sharing competitive scores, version the complete model, tuning,
  enabled assists, scoring rules, input log and executor; a pose fingerprint
  or an attractive replay picture cannot establish those conditions alone.
