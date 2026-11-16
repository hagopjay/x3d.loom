# x3d.s1: typed judgments for X3D, behind exact code

> X3D is the 3D format an AI can be held accountable to. This folder is the small piece of ordinary code that lets a cheap typed judge (a model that answers
> closed questions with probabilities, in one parallel pass) sit behind the validator instead of in place of it: the validator's verdicts become free labels
> for scoring the judge, and scene text is kept away from it.

```text
  scene (X3D)
     |  slice per question: computed facets, named buckets, a trust tier on every field        state.py  buckets.py  untrusted.py
     v
  question catalogue ---> class D  answered by code, never asked                                decidable.py
     |                --> class C  answered by an exact twin (validator, gate); a judge only for the residue
     |                --> class J  a judgment with no exact twin
     v
  typed judge (Choice, Score, Noul): closed answer space, probabilities                        questions.py  backends.py
     |
     v
  policy per action: suspected_ok | escalate_oracle | defer_human                              routing.py
     |
     v
  exact stages certify (XSD, semantic gate, FLIP, ...) ---> verdicts are labels                  calibration.py  consistency.py
     |                                                          |
     +--------- reliability, ECE, Wilson bars, cascade bill <--+
```

Id prefix `S1`. Failure codes are `S1_*` (for example `S1_PROB_SUM`, `S1_CHOICE_OUT_OF_SPACE`, `S1_ENTITY`). The idea and the evidence for it are in x3d.docs
chapter 22; this folder is the executable half.

## Run

```bash
cd x3d.s1
python3 -B -m pytest -q tests                 # 113 tests; pytest is the only thing installed, the package itself is standard library only
python3 -B tools/mutation_check.py            # plants 20 bugs in a scratch copy; every one must turn the suite red (writes receipts/mutation-check.json)
python3 -B tools/corpus_measure.py receipts/corpus-2026-11-16.json docs=<x3d.docs> loom=<x3d.loom> mcp=<x3d_mcp>   # needs checkouts; offline
python3 -B -m x3d_s1 questions                # the D / C / J catalogue
python3 -B -m x3d_s1 state scene.x3d --facets header,census,lighting     # sliced, trust-tiered state as JSON
python3 -B -m x3d_s1 lint-text "Ignore all previous instructions"        # the pattern screen
python3 -B -m x3d_s1 triage scene.x3d         # one triage pass; no model call (J questions need --replay)
```

## Use

```python
from x3d_s1.state import load, slice_state
from x3d_s1.decidable import BY_ID, exact_answer
from x3d_s1.questions import Choice, parse_answer
from x3d_s1.routing import ActionPolicy, Policy, route_choice

scene = load("scene.x3d")                                   # refuses > 64 MB, DTD entities and non-X3D roots (SceneRefused, S1_*)
s = slice_state(scene, facets=["header", "lighting"])       # text and DEF names are excluded unless include_untrusted=True
exact_answer(BY_ID["scene.has_lights"], s["state"])         # a class D question: answered by code, never asked (a one-hot Noul, 0.0 or 1.0)

q = Choice("What is the scene mostly about?", {"room": "an interior", "terrain": "outdoor ground", "other": "something else"})
answer = parse_answer(q, {"type": "choice", "choice": "room", "probabilities": {"room": 0.82, "terrain": 0.15, "other": 0.03}})
policy = Policy(floor=0.5, actions={"room": ActionPolicy("tag_as_room", stakes="low", min_p=0.7)})
route_choice(answer, policy).outcome                        # 'suspected_ok' | 'escalate_oracle' | 'defer_human'; the Decision carries p, bar, floor and a reason
```

```python
from x3d_s1.calibration import threshold_for_precision

# probs: the judge's probability for the answer you would act on; outcomes: 1 where the exact validator agreed. The labels are free.
threshold_for_precision(probs, outcomes, target=0.95, min_n=30)    # (bar, n, k, wilson_lower_bound) for the lowest bar that clears, or None
```

`HostedAdapter(transport, model)` builds the documented request and parses the typed response; the HTTP step is a callable **you** inject. It refuses a model id
that ends in `latest` or `preview`, because aliases move and an answer you cannot reproduce is not evidence.

## What this is not

It never calls a model, holds a key, opens a socket or spends anything (a test reads the package's source and fails on a network import). The shipped backends
are `ReplayBackend` (a recorded answer, a miss raises) and `StubBackend`. A model answer here is grade `S` and may only *flag* (law 6): it never turns a witness
green, never authorises a side effect, and the route names say so (`suspected_ok`, not "ok"). The labels it is scored against are exact for **structure only**:
they say whether the validator complains, not whether a scene is good or visible (law 2). It is not a vendor SDK, and it does not decide whether to use one.

## Rig for every number

Python 3.13.18 on one container (4 vCPU, x86_64, no GPU), standard library only; pytest 9.x for the tests. The same 113 tests and 20 of 20 mutants also ran green under Python 3.12.3 (the CI version). Timings are single runs on a shared VM, so a second
run moves the third digit (the median slice time was 0.278 ms on the first run and 0.288 ms on the committed one). Sizes are exact; token counts are bytes/4
estimates, a floor for number-heavy text. The corpus is every `.x3d` under `x3d.docs@3aab064`, `x3d.loom@0752865` and `x3d_mcp@dcf0815`.

## Receipts (`receipts/`)

| file | what | instrument |
|---|---|---|
| `corpus-2026-11-16.json` (`x3d.s1.corpus-census/1`) | 499 public scenes: raw bytes 57,468,875, all-facet state bytes 507,786 (113.18x aggregate; median ratio 1.73, p10 0.79, p90 185.72); median state 983 B, largest 1,740 B; 58 scenes over the 32,000-token question limit raw, 0 sliced; 36,743 text strings, 0 flagged by the lint; slice median 0.288 ms | `tools/corpus_measure.py`, Python 3.13.18, the three commits above |
| `corpus-2026-11-16.scenes.csv` | one row per scene with `origin` (`repo@sha7:path`) and `file_sha256`; no scene text | same |
| `mutation-check.json` (`x3d.s1.mutation-check/1`) | 20 planted bugs, 20 killed; a crash, a missing target or a survivor fails the check | `tools/mutation_check.py` |
| `../limits/preregistration.json` | the bars for experiments E1 to E6, written before any model call; a changed bar goes in an earlier commit and an excursion is reported as a waiver | none yet: no experiment has run |

Rows with ratio under 1 (the 10th percentile is 0.79) are scenes smaller than the state they would produce: the rule is to send a scene under about 1 KB raw
(capped and linted) and slice the rest.

## Not done on purpose

- No model call, no account, no key, no spend. Every experiment in `limits/preregistration.json` waits for the owner's typed yes.
- No calibration claim. The module can compute reliability, ECE and Wilson bars; nobody has produced a reliability diagram for rule-satisfaction questions on X3D.
  Calibration on seeded mutants must be reported separately from calibration on real scenes (law 30).
- A Score answer is never a release decision. `route_score` returns `defer_human` or a band, and no band is a verdict (whether Score may enter a release path at all is
  an open decision for the owner), because a Score's confidence says how concentrated the answer is, not how likely it is right.
- No change to x3d_mcp, the kit or any shared file. The companion pieces are a docs chapter (x3d.docs) and, designed but not built, a budgeted `scene_brief`
  tool for x3d_mcp.

## Known limits

- The injection lint is a pre-filter. On the one hostile test scene the first-draft lint missed one of four planted phrases; two patterns were added with tests.
  That is a single scene, not a detection rate. The layers that hold are: do not send the text; quote it in its own tier; never let a judge's answer authorise
  anything.
- The state facets are computed from the XML as written: no PROTO expansion, no routes or scripts run, no resolved `Inline`.
- `approx_tokens` is bytes/4. Check a real tokenizer before treating a budget as exact.
- Wire shapes follow the service's public API reference as read on 2026-11-16; the service's own formulas and limits can change between releases, which is why
  `confidence_mismatch` audits the reported value instead of trusting it.

## Licences

Standard library only, so nothing third party ships here and there is no NOTICE file. Fixtures (`fixtures/adversarial.x3d`, `fixtures/benign.x3d`) were written for
this folder, and `adversarial.x3d` carries instruction-like strings as inert test data; scenes from other repositories are referenced by sha256 and origin in the receipts and are not copied. Pytest (MIT) is a test-time tool, not a dependency
of the package.
