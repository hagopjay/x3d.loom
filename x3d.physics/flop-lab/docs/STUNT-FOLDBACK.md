# Showtime: portable gameplay lessons

This record accompanies the stunt-play expansion. It distinguishes source-level
design observations from executed evidence. Exact test outcomes and browser
observations belong to the release validation record; a proposal here does not
mint a Loom law or formal profile acceptance.

## 1. Credit the result of an ability, not its input button

**Risk.** A refused dash or puff can become a score source if the score observer
reads a key press rather than the ability owner's accepted result.

**Design boundary.** Expedition owns legal dash application; Showtime receives
the accepted dash outcome. Showtime owns legal puff application and emits its
event only after an impulse is applied. The display consumes these events.

**Review target.** Grounded, disabled, cooling-down and out-of-charge actions
must consume no new charge and generate no credited ability event. A legal
airborne or ragdoll action supplies the healthy twin. The concrete controls are
in `test/showtime.test.mjs` and `test/showtime-integration.test.mjs`.

**Portable heuristic.** Put the authoritative yes/no decision at the mutation
boundary and propagate its result outward. Avoid independently guessing legality
in score, sound and UI code.

## 2. A chain has an owner and a completion boundary

**Risk.** A last-stunt record can remain visible for many frames. Banking it each
time it is read duplicates a reward. A death or source rebuild can also leave
an attractive pending score that no longer belongs to the current attempt.

**Design boundary.** New stunt/completion identity and explicit run resets bind
pending points to one live performance. Recovery, including F in midair, can bank that performance;
respawn discards its pending chain. This is not a safe-grounded-landing test. Session totals are separate from attempt
state and deliberately persist across course/mission rebuilds within one page.
They are not course-comparable records. Three new puffs reload on each new flop;
recovery/flop cycles can extend flight by design, so per-chain caps must not be
promoted into a global anti-farming or anti-cheat claim. Pose review does not execute the live scoring hooks.

**Review target.** Repeated reads of the same record, respawn before recovery,
fresh-Sim reconstruction and return from review should not create another bank.

**Portable heuristic.** Model ownership and event order explicitly before adding
a multiplier. A friendly number is still state that needs a reset contract.

## 3. Variety requires a bounded grammar

**Risk.** Resting contacts, repeated event delivery and tiny angular oscillations
can look like endless tricks if every observation earns its full value.

**Design boundary.** Recognized motion, distinct categories and bounded repeated
events reward composed play. Show values are authored game design, separate
from physical acceptance limits and from Expedition medal comparability.

**Review target.** Keep a repetitive route or stale-event specimen beside a
healthy varied route. Verify the specific repetition rule, not simply a final
score greater than zero. Rewarded motion should remain distinguishable from
waiting and noise.

**Portable heuristic.** A score economy is a small interpreter. Define its
accepted event language, identity, ordering, limits and termination conditions.

## 4. New assists need a visible comparison category

**Risk.** A new movement ability can make an older challenge easier while the
interface continues presenting its medal as directly comparable with stock
attempts.

**Design boundary.** Showtime is an open local play layer. Actual puff use marks
the current Expedition session as practice. Merely having an assist available
does not need to consume it or create an ability event.

**Review target.** The challenge remains eligible before assist application and
becomes practice after a legal assist. Retry alone does not silently restore
eligibility under changed rules.

**Portable heuristic.** Preserve playful freedom while naming the conditions
under which records can be compared. Do not hide a new rule inside an old badge.

## 5. Sensory controls own the whole output path

**Source observation.** The inherited application had a legacy `beep()` path
that could initialize audio after a general pointer gesture. A new sound-off
control would be misleading if it governed only the new celebration synth.

**Repair.** The UI owner removed the inherited automatic and delayed beep
paths. Explicit enable/mute/volume now govern the new feedback synth; the audio
status reports actual availability. Reduced motion covers new particles and
world bursts/shake, while preserving text. The operating-system request is
always respected rather than overridden by a less restrictive app toggle.

**Review target.** Exercise ordinary jump/bonk/star effects as well as new show
effects with sound off; pause or mute before a delayed effect; inspect the
reduced-motion route. Direct browser observations remain separately scoped.

**Portable heuristic.** An accessibility or preference control is a contract
across all producers of that output, including inherited producers.

## 6. Feedback is an observer with a budget

**Risk.** A pileup can create a burst storm; re-delivered events can duplicate
effects; a paused or hidden tab can accumulate an obsolete presentation backlog.
If feedback consumes simulation randomness, a visual preference can even change
later physical behavior.

**Design boundary.** Presentation owns its own bounded transient state and
event deduplication. It does not mutate the simulation, emit score or consume
the simulation random stream. Live fixed-step state and display-time effects
remain separate.

**Review target.** Check bounded effect counts and lifetimes, duplicate events,
paused/hidden delivery and neutral-observer trajectory equivalence. A successful
software-rendered observation does not establish hardware-GPU performance.

**Portable heuristic.** Budget the event fan-out before making the celebration
bigger. A dramatic moment should spend a known amount of presentation work.

## Executed integration evidence

`node test/showtime-integration.test.mjs` passed eight actual-Sim/integration
controls in the independent audit. They cover 300 neutral tick fingerprints,
legal/refused puff impulses, a three-charge cap, a same-host repeated trace and
disabled twin, ordinary stock-spawn banking, recovery versus death, run
replacement/stale results, and the actual app review guard with a sentinel.
The ordinary jump/flop/three-puff/recover trace banks 510 toy points. The
app-guard control uses the extracted real function with an adapter; it is not
a complete browser session. See `SHOWTIME-AUDIT.md` for exact input sequences,
changed-state twins and scope.

The feedback source declares presentation bounds and preference handling.
Code-level controls for those policies are distinct from a listening test,
a real audio-device measurement or evidence that people find a caption funny.
The final release record owns the executed presentation checks and subsequent
browser observations.

## Evidence map

| Domain | Owning source | Instrument or record |
|---|---|---|
| Puffs, chains, prompts and stickers | `src/showtime.js` | `test/showtime.test.mjs` |
| Actual trajectories and integration boundaries | `src/game.js`, `src/expedition.js`, `src/showtime.js` | `test/showtime-integration.test.mjs`, `docs/SHOWTIME-AUDIT.md` |
| Sensory feedback | `src/celebration.js`, `src/app.js` | Presentation controls and final live-observation record |
| Source course and identity | `src/recipes.js`, `src/x3dio.js` | Export inventory and X3D validation record |
| Historical vs current evidence | Existing receipts plus new release reports | Final validation record; historical bytes stay historical |

The playbook explains implementation choices and proposes future work. Neither
its prose nor a collection of passing controls establishes universal fun,
complete-state replay, native X3D physics equivalence, or a shared verified
leaderboard.
