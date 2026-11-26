# Modeling and simulation under the Loom: x3d.downey (23 Nov 2026)

**What was built.** A new repository, x3d.downey: seven rooms after Allen Downey's *Modeling and Simulation in
Python* (No Starch 2023; code MIT, text CC BY-NC-SA, none copied). Each room is a card, a standard-library Python
model, a case bank, an X3D 4.0 scene and a live lab on one page: the falling penny (ch. 1, 20, 21), the bike share
(2-4), world population (5-10), the freshman plague (11-14), coffee and milk (15-16), the wall problem (22-23) and the
Earth falling into the Sun (20, 26). The genesis run was accepted under its own profile `x3d-downey/v1` through this
kit (grammar, meaning, traps, page-traps, and ten `command` witnesses), with a receipt.

Grades: C, measured by the thread that built it, so **Likely** under law 44 until a second reader recomputes.
Failure modes 407 to 422 in LOOM-v1.md §8 come from this build and its second session. No new law.

_Numbering: the foldback kit numbered these 229 to 257 against x3d.loom a2a3ef0 (last was 228). By the time it was applied
(26 Nov, main 434b580) upstream had reached 406, so every number here is the kit's plus 178: 229 → 407 … 257 → 435.
x3d.downey's own LEARNINGS.md and its evidence still use the kit's numbers._

## Downey's loop is the Loom's loop

| Downey | Loom |
|---|---|
| the system and its question | the card (step 0) |
| abstraction: what to keep, what to leave out | the loss report (law 40) |
| the model as a program | generator, not file (law 1) |
| iterative modeling, one feature at a time | one cause at a time (law 29) |
| internal validation between successive models | limit agreement: a rung with its feature off is the rung below |
| analysis and simulation agree | exact references; every check ships its wrong twin (law 44) |
| difference vs differential equations | the scheme's own answer is the reference (PHYSICS-PLAYBOOK 1) |
| external validation against data | truth gates; a hold-out |
| false precision | display precision is part of the budget (law 23) |
| computation with units | name the instrument behind every number (law 15) |
| "Dysfunctions" and the book's other bugs | negative controls that fail for the intended reason (law 19) |
| restart and run all | evidence bound to the candidate (law 17); remake byte for byte (law 4) |

**The book's bugs are ready-made controls.** Downey shows his readers their likely mistakes on purpose (negative
bikes, a function that rebuilds its own System, a forgotten return, swapped arguments). As one-line mutants they are
exactly what law 19 asks for. 21 were run: 20 caught by the checks their cards named, 1 survived as its card predicted
(failure mode 408), and 1 prediction was wrong and corrected in the open (409).

## Patterns worth copying

1. **When a Monte Carlo model is a small Markov chain, compute the exact answer.** The bike share has 13 states; the
   expected unhappy riders after 60 minutes is a sum over the chain's distribution. Every sweep point is then judged
   against an exact value within 4 standard errors (31 of 31; worst 2.55).
2. **Write a gap ledger.** When a simulation and an analysis disagree, split the gap into its causes, one cause at a
   time (law 29), so that the pieces telescope exactly: for the plague, the daily step, the finite horizon, the
   initial seed. Gate that the ledger closes; report which cause dominates where.
3. **A collapse is an invariance: witness the invariance.** Scaling both SIR rates by k is running the clock k times
   faster; checked along the solution to 1e-16, it is why Downey's sweep collapses, and why the stepped model does
   not (414).
4. **Predict survivors.** A mutant that the model cannot see (an area absorbed into a fitted coefficient) is written
   on the card as expected to survive, with the reason. It teaches identifiability, and it is never counted as a catch.
5. **Portable random streams make Monte Carlo replayable.** xoshiro128** seeded by splitmix32, compared as 24-bit
   integers, gives the same bits in Python and JavaScript: 60 of 60 step hashes and all 31 sweep means equal.
6. **A bank is an input to a replay: keep its floats exact** (407).

## Open

A second reader for every number; Firefox, WebKit, a GPU, a phone; a person's judgement of the scenes; the glucose,
rotation and yo-yo chapters (x3d.downey ROADMAP.md).

## Second session: the monolith and Think Complexity (23 Nov, evening)

x3d.downey became one repository for Downey's books: *Think Complexity* (2nd ed.) joined with six rooms (Erdos-Renyi,
small worlds, elementary CA, Life, percolation, the abelian sandpile) on the same core, cards and witnesses.

- **Discrete models give more exact references, not fewer.** Theorems checked cell by cell (Lucas for rule 90,
  Gilbert's recurrence for connectivity, Dhar's abelian property for the sandpile), complete enumeration of small
  cases (every 4 x 4 percolation stone, every graph on 5 nodes), Life's known patterns re-derived from the rule.
- **Integer runs replay exactly across hosts.** The page's JavaScript reproduces every Monte Carlo fraction, every
  CA row, all 1,144 R-pentomino populations and all 5,000 avalanche sizes bit for bit.
- **A blind second reader works.** A fresh agent given only the cards, the data and the book (no code, no banks)
  recomputed 38 ModSimPy numbers with scipy and numpy: 38 agree. It promotes them from Likely to Confirmed under
  law 44, and it read a claim the figures witness had passed (416).
- **Symmetry hides bugs; light cones hide boundaries; caps hide failure** (417 to 420).

## Third session: Think Stats and x3d.xray's protocol (23 Nov, night)

*Think Stats* (3rd ed.) joined with six rooms on the NSFG 2002 pregnancy file and on exact enumeration: an audit of
the data, Downey's first-babies question, the class-size paradox, the central limit theorem, estimation, and
confounding by mother's age.

- **Limits committed first are looks declared first.** x3d.xray's declared-looks protocol (vendored byte for byte,
  its grade rule ported with thresholds unchanged) graded the first-babies question: length and weight differ
  beyond chance (0 of 455 shuffles) but below the effect floor, so nothing is graded; mother's age is Confirmed.
  A searched garden of 60 analyst paths finds 6 below p 0.05 and none surviving BH. The card is the declared
  family, and the garden is what the card prevents.
- **Planted controls are wrong twins for a protocol.** Shuffled labels must grade nothing; a planted shift must be
  Confirmed. Both ran through the same code as the real labels.
- **Exactness turns identities into checks.** Least squares in rationals makes orthogonality, the omitted-variable
  decomposition and Frisch-Waugh-Lovell zero-tolerance checks, and a float solver a wrong twin only they can see.
- **Read the data three ways.** The NSFG file was read from its dictionary by new Python, by pandas, and by
  JavaScript with zlib; all agree with every count the book prints, and the page replays Downey's permutation test
  from the same SplitMix64 stream bit for bit.
- Failure modes 423 to 432.

## Fourth session: content-bound evidence, a pinned kit, blind readers for every book (24 Nov, small hours)

- **Evidence must survive a replay.** x3d.downey's commits are signed; a patch cannot carry signatures, so every
  replay gives new SHAs. Its limits witness now binds law 44 to content (card blobs, limits hashes, the order of the
  first card and first code commits) and verifies on a replay whose every SHA differs. Failure mode 433.
- **Pin the kit by content.** After a run on an older checkout went unrefused, this kit's acceptance learned an
  optional `kit: {kit_sha256}` in profiles and the code `WRONG_KIT` (3 new controls, 154 caught). Failure mode 434.
- **Blind readers for Think Complexity (21 numbers) and Think Stats (41), from stripped cards.** All agree. The
  Complexity reader found two places where a card misdescribed Downey (failure mode 435); the Stats reader found,
  unprompted, the book's mixed-sample age gap that the card already recorded. Law 44's second reader is cheap and
  it keeps finding what the building thread cannot.

