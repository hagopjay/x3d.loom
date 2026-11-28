# Engineering study card

Fill this in **before** the run of record and commit it on its own. Copy it to `card.json` (schema `loom.eng-card/1`) or `docs/CARD.md` in the study. A field left empty is a decision not yet made; say "none" when the answer is none. The patterns are E1 to E12 in [ENGINEERING-PLAYBOOK.md](../../ENGINEERING-PLAYBOOK.md). Two filled cards: `x3d.engineering/fourbar/card.json` and `x3d.engineering/ifc-truss/card.json`.

## 1. The design and its label
- What is being designed or exchanged, in one sentence:
- The label every page and file will carry (for example "a worked study, not for construction; no licensed engineer has reviewed it"):
- Units, up axis and datum of every file that crosses a boundary (E4):

## 2. Requirements (E1): write the check beside each
| Id | Shall | Check that can fail | Limit (written now) | Where the limit comes from (function, a clause, a choice) |
|---|---|---|---|---|
| R1 |  |  |  |  |

A line with no check is not a requirement yet. A limit that comes from a number you saw in exploration is not a limit; derive it from what the part must do.

## 3. Load cases and the envelope (E2, E8)
| Case | Loads and factors | From which clause |
|---|---|---|
|  |  |  |

- The operating range you **claim** (speeds, loads, temperatures, sizes):
- The points beyond it you will **probe and report** without gating:
- Coverage: which cases must run for the result to count (a gate of its own):

## 4. Codes and standards (E3)
| Clause, with edition and year | Text as used | Read from (the document itself, a quoting source, memory) | Grade |
|---|---|---|---|
|  |  |  |  |

Memory is S. A source that quotes the code is L. Only the code's own text, opened and read, is better. A design that passes on S clauses says so on its page.

## 5. References (E7): at least two kinds
| Id | Kind (closed form, identity, second solver, order, cross-implementation) | What it checks | Limit | Wrong twin that must fail |
|---|---|---|---|---|
| REF1 |  |  |  |  |

## 6. Instruments and their qualification
| Instrument (engine, mesher, converter, reader), pinned version | What it is trusted for | Where it stops holding the limits |
|---|---|---|
|  |  |  |

Judge the design only inside the range where enough instruments qualify. State how many "enough" is (two independent ones, here).

## 7. Exchange (E5, E6): only if a file crosses a format
- The identity that joins the two sides (GlobalId, link name, reference designator, entity id):
- Quantities recomputed on both sides, by which two pieces of code:
- **Carried** (each will be measured equal on every element):
- **Lost** (each will be measured absent, and named on the page):

Every kind of thing the source says goes on exactly one of the two lists. A key on neither fails.

## 8. Failure table (E9)
| Control | What is made wrong | Requirement or reference it must break | Severity if it shipped (1 to 5) | Caught? |
|---|---|---|---|---|
|  |  |  |  |  |

The witness exits non-zero when any control survives.

## 9. Exploration and honesty
- What you ran before this card was committed, and what you saw:
- Which limits were set after seeing numbers, and what each is derived from:

## 10. Operating data (E10)
- Recorded operation to replay against the model, or "none":

## 11. Configuration (E12)
- Pinned tools and versions; the validator and its commit:
- Hashes of inputs; which outputs are byte-reproducible and which are not, and why:
- Profile and receipt path:

## 12. Not checked
- A second reader (E11), a licensed review, a real GPU, another machine, anything the label must admit:
