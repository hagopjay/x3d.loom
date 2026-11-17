# x3d.s1 0.2.0: typed judgments for X3D, behind exact code

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

> **0.2.0 status.** Offline, standard library only. No account, key, live request, model calibration or release acceptance is claimed. The tests, mutation check
> and census below were re-run on this tree; the superseded earlier figures are kept as dated receipts and named as such where they appear.

## Run

```bash
cd x3d.s1
python3 -B -m pytest -q tests                 # 207 tests; pytest is a test-only dependency, the package itself is standard library only
python3 -B tools/mutation_check.py            # plants 41 bugs in scratch copies; writes receipts/mutation-hardening.json (x3d.s1.mutation-check/2)
python3 -B tools/corpus_measure.py receipts/corpus-current.json docs=<x3d.docs> loom=<x3d.loom> mcp=<x3d_mcp>   # needs checkouts; offline
python3 -B -m x3d_s1 questions                # the D / C / J catalogue
python3 -B -m x3d_s1 state scene.x3d --facets header,census,lighting     # sliced, trust-tiered state as JSON
python3 -B -m x3d_s1 lint-text "Ignore all previous instructions"        # the pattern screen
python3 -B -m x3d_s1 triage scene.x3d         # one triage pass; no model call (J questions need --replay)
python3 -B -m x3d_s1 evidence SOURCE CLAIMS.json [--strict] [--require verified|reworded] [--quotes]
```

The offline **Decision Observatory** (`observatory/`, `python3 observatory/server.py`) rehearses these boundaries in a browser with authored synthetic probabilities: no model, no key, no network. Its optional 3D pane needs `python3 observatory/tools/fetch_renderer.py`; the rest does not.

## Use

```python
from x3d_s1.state import load, slice_state
from x3d_s1.decidable import BY_ID, exact_answer
from x3d_s1.questions import Choice, parse_answer
from x3d_s1.routing import ActionPolicy, Policy, route_choice

scene = load("scene.x3d")                                   # refuses > 64 MB, DTD entities and non-X3D roots (SceneRefused, S1_*)
s = slice_state(scene, facets=["header", "lighting"])       # text and DEF names are excluded unless include_untrusted=True
exact_answer(BY_ID["scene.has_lights"], s["state"])         # a class D question: answered by code, never asked (0.0 or 1.0); omitting the facet raises S1_EXACT_STATE

q = Choice("What is the scene mostly about?", {"room": "an interior", "terrain": "outdoor ground", "other": "something else"})
answer = parse_answer(q, {"type": "choice", "choice": "room", "probabilities": {"room": 0.82, "terrain": 0.15, "other": 0.03}})
policy = Policy(floor=0.5, actions={"room": ActionPolicy("prioritize_room_review", stakes="low", min_p=0.7)})
route_choice(answer, policy).outcome                        # 'suspected_ok' | 'escalate_oracle' | 'defer_human'; the Decision carries p, bar, floor and a reason
```

`suspected_ok` is an advisory flag, never a required witness or a release verdict. `load` refuses oversized inputs, declared XML entities and non-X3D roots; scene free
text and DEF names stay out unless the caller opts into the untrusted tier, and included text is capped, quoted and screened. Pattern screening is not a prompt-injection guarantee.

`HostedAdapter(transport, model)` builds the documented request and parses the typed response; the HTTP step is a callable **you** inject (the package has no HTTP client,
key storage or vendor SDK, and a test reads its source and fails on a network import). It refuses a model id that is empty, ends in `latest` or `preview`, requires the
served model to equal the pinned requested model, validates answer identifiers and typed values before publishing response metadata, and clears stale metadata before each
attempt. `ReplayBackend` and `StubBackend` support offline runs; their outputs are not measurements, and a missing replay answer raises.

## What changed in 0.2.0

| Boundary | Current behaviour |
|---|---|
| TimeSensor detection | A `TimeSensor` is counted as a timer before the generic sensor branch, so a scene whose only animation is a timer answers `scene.is_animated` correctly. Behaviour facets carry explicit zero counts. **Measured effect on the same 520 scenes: 33 animated before, 56 after** (an independent element scan also finds 56), so the earlier count under-reported animation. |
| Exact D facts | A required facet or field must exist with its expected type. Missing context cannot silently become zero, false, `tiny` or `Full` (`S1_EXACT_STATE`). The guard checks the computed-state contract, not the X3D specification. |
| Budgeted J context | If slicing removes a question's required facet, the group records `S1_MISSING_FACET` and abstains before any backend call. |
| Imported C answers | A caller-supplied `twin_results` mapping is accepted for inspection but recorded as `source=unverified_import`, `route=escalate_oracle`. The core never mints an artifact-bound Loom witness from a mapping. |
| Numbers and distributions | Non-finite or out-of-range probabilities and confidence, ambiguous Score level keys, invalid policy thresholds, mismatched calibration arrays and non-binary outcomes are refused; invalid values cannot vanish from reliability bins. |
| Hosted response identity | Missing or different served-model ids and malformed responses fail closed. |
| Receipt identity | The complete default policy is recorded, so two policies that share a probability threshold but differ in default action or stakes cannot share a receipt. |
| Mutation evidence | The unmutated copy must pass; every mutant starts from the same tested snapshot, must compile, and must fail a named behavioural test. See below. |

`screen()` concerns optional advisory work only; its legacy `skip` result can never skip a required Loom witness. Acceptance stays independent of every model probability,
score, replay output and route name. A Score band is a reporting category, not a verdict.

## Calibration arithmetic has a scope

```python
from x3d_s1.calibration import threshold_for_precision

# probs: the judge's probability for the answer you would act on; outcomes: 1 where the exact validator agreed. The labels are free.
threshold_for_precision(probs, outcomes, target=0.95, min_n=30)    # (bar, n, k, wilson_lower_bound) for the lowest bar that clears, or None
```

This picks a candidate threshold on the data it is given. Searching thresholds and quoting a Wilson bound on the same data is not a simultaneous or out-of-sample
guarantee: freeze the threshold, evaluate a grouped independent holdout (no scene-family or prompt leakage), and keep seeded mutants apart from real scenes (law 30).
Reliability, ECE, Brier and log loss describe supplied predictions; computing them does not make a model calibrated.

## Evidence: a quote beside a value, checked by code

A judged answer or a written claim ("the pier is 6 m tall") can come with the exact words it rests on. `x3d_s1.evidence` checks that in plain code, with no model:
**FIND** the quote as an unbroken run of whole words inside one source string, **COMPARE** the value to the quote (numbers as numbers, `4.200` read as 4.2 or 4200,
a vector in order, an identifier by case), **LOCATE** it (node path, attribute, MFString item, character span). The verdicts are `verified`, `check`, `reworded` and
`unchecked`; no quote is `unchecked`, never "false". The method is the FIND / COMPARE / LOCATE check of source tracing (GAIK, MIT); the code here is an independent
implementation of the verdict table, and `check_claims(..., verifier=callable)` is the slot for the richer x3d.ML engine (`x3dtrace`) without importing it.

```bash
python3 -B -m x3d_s1 evidence SOURCE CLAIMS.json [--strict] [--require verified|reworded] [--quotes]   # exit 0 only if every claim clears the bar
```

Rules that follow from the lane's laws: a quote is untrusted scene text, so it and the string it sits in go through the lint, and a flagged one can never verify;
a verified quote caps a *claim* at grade `L` and anything else at `S`, never `C` (law 6: the CHECK is exact, the claim is still model-written); the route cap only
tightens (`ROUTE_FLOOR`, tested over 4 verdicts x 3 routes) and never turns a witness green; a quote from the scene's own text shows what the scene *says*, so it
never replaces a twin for a class C or D question. Preregistered bars: E7 and E8 (no model) and E9 (a model copying quotes, gated on the owner's typed yes), in
`limits/preregistration.json`, written in an earlier commit than the code.

Measured (`tools/evidence_measure.py`, offline, Python 3.13.18, one run, 501 scenes: `x3d.docs@4d394d7`, `x3d.loom@7a7d657`, `x3d_mcp@dcf0815`; claims planted by
code, so truth is known by construction): true claims 5,782 of 5,808 verified (Wilson 95% lower bound 0.99345, the E7 bar is 0.99); wrong number 0 of 806, a word
outside the quote 0 of 5,357, a fabricated quote 0 of 5,808, a quote from another string 0 of 1,696, a known injection phrase quoted as evidence 0 of 501 (each zero
has a rule-of-three upper bound in the receipt). **Blind spot, reported not hidden:** 501 of 501 paraphrased instruction-like strings the lint was never shown
verified as quotes, because the lint is a pre-filter and a verified quote proves the words are there, not that they are true or in the right place.

## What this is not

It never calls a model, holds a key, opens a socket or spends anything. A model answer here is grade `S` and may only *flag* (law 6): it never turns a witness green,
never authorises a side effect, and the route names say so (`suspected_ok`, not "ok"). The labels it is scored against are exact for **structure only**: they say whether
the validator complains, not whether a scene is good or visible (law 2). It is not a vendor SDK, and it does not decide whether to use one.

## Mutation check: what the old receipt did not prove

`receipts/mutation-check.json` (`x3d.s1.mutation-check/1`, 41 of 41) is kept unchanged but is **not evidence of test strength**. That harness copied the package without
`receipts/`, and the README drift tests read the receipts, so each copied suite failed with a missing-file error that had nothing to do with the planted bug. An unrelated
failure counted as a kill. Re-running with the fixtures present, with no named-test requirement, shows the effect: **one of the 41 mutants survived**, "lint not run on
quotes" (the injection lint skipped on the quote itself). `test_an_instruction_like_quote_is_flagged_even_when_it_is_not_in_any_source` now kills it.

The revised harness (`x3d.s1.mutation-check/2`, `receipts/mutation-hardening.json`) runs the real suite and an unmutated copy first (both must pass), starts every mutant from
the same snapshot, checks that the mutated source compiles, and calls a mutant `killed` only when a failing test is one named for that operator. Other outcomes are
`SURVIVED`, `UNRELATED_FAILURE`, `INVALID_RUN`, `INVALID_SOURCE`, `MISSING_TARGET` and `CRASH`; any of them fails the check. Current result: **41 planted bugs, 41 killed**,
each by a named test. Its scope is these 41 operators and this suite; it is not proof of general defect detection. Re-run it after editing README, tests or instruments.

## Receipts (`receipts/`)

| file | what | instrument |
|---|---|---|
| `corpus-current.json` (`x3d.s1.corpus-census/1`) | **Current.** 520 public scenes: raw bytes 57,609,927, all-facet state bytes 565,878 (101.81x aggregate; median ratio 1.81, p10 0.73, p90 162.22); median state 1,052 B, largest 1,802 B; 58 scenes over the 32,000-token question limit raw, 0 sliced; 37,882 text strings, 9 flagged, all in the two planted hostile fixtures (`x3d.s1/fixtures/adversarial.x3d`, x3d_mcp `injection_scene.x3d`), none in a real scene; D prevalence: 56 animated, 128 lit, 443 with a viewpoint, 6 with remote references, 5 with scripts; slice median 0.353 ms | `tools/corpus_measure.py`, Python 3.13.18, `x3d.docs@a9b5f33`, `x3d.loom@be7c481`, `x3d_mcp@c6681fe` |
| `corpus-current.scenes.csv`, `corpus-current.unparsed.json` | per-scene rows with `origin` (`repo@sha7:path`) and `file_sha256`; no scene text; 0 unparsed | same |
| `corpus-2026-11-16.json` (`x3d.s1.corpus-census/1`) | **Superseded, kept for provenance.** 499 public scenes: raw bytes 57,468,875, all-facet state bytes 507,786 (113.18x aggregate; median ratio 1.73, p10 0.79, p90 185.72); median state 983 B, largest 1,740 B; 58 scenes over the 32,000-token question limit raw, 0 sliced; 36,743 text strings, 0 flagged by the lint; slice median 0.288 ms. It predates the TimeSensor fix and used older commits; on the same 520 scenes the old code measured 530,416 state bytes and 33 animated scenes. | `tools/corpus_measure.py`, Python 3.13.18, `x3d.docs@3aab064`, `x3d.loom@0752865`, `x3d_mcp@dcf0815` |
| `corpus-2026-11-16.scenes.csv` | one row per scene of that run | same |
| `mutation-hardening.json` (`x3d.s1.mutation-check/2`) | **Current.** controls, named failing tests, tested snapshot digest; 41 planted bugs, 41 killed | `tools/mutation_check.py` |
| `mutation-check.json` (`x3d.s1.mutation-check/1`) | **Superseded; not evidence** (see above): 41 planted bugs, 41 killed | the earlier harness |
| `evidence-2026-11-16.json` (`x3d.s1.evidence-measure/1`) | 11,616 true and 13,667 planted-wrong claims plus 501 injection quotes, over 501 scenes, per family counts, Wilson and rule-of-three bounds, the paraphrase blind spot; aggregates only, no scene text | `tools/evidence_measure.py`, Python 3.13.18, the three commits in the file |
| `../limits/preregistration.json` | the bars for experiments E1 to E9, written before any model call (E7 and E8 need none); a changed bar goes in an earlier commit and an excursion is reported as a waiver | none yet: no live experiment has run |

Rows with ratio under 1 (the 10th percentile is 0.73) are scenes smaller than the state they would produce: the rule is to send a scene under about 1 KB raw
(capped and linted) and slice the rest. `approx_tokens` is bytes/4, a budgeting heuristic and not a tokenizer.

## Rig for every number

Python 3.13.18 on one container (4 vCPU, x86_64, no GPU), standard library only; pytest 9.x for the tests. Timings are single runs on a shared VM, so a second run moves
the third digit. Sizes are exact; token counts are bytes/4 estimates. The suite and the mutation check are also run under Python 3.12 (the CI version) before merge.

## Not done on purpose

- No model call, no account, no key, no spend. Every experiment in `limits/preregistration.json` waits for the owner's typed yes.
- No calibration claim. The module computes reliability, ECE and Wilson bars; nobody has produced a reliability diagram for rule-satisfaction questions on X3D.
- A Score answer is never a release decision. `route_score` returns `defer_human` or a band, and no band is a verdict, because a Score's confidence says how concentrated the
  answer is, not how likely it is right.
- No change to x3d_mcp, the kit or any shared file from this folder. The companions are x3d.docs chapter 22, the budgeted `scene_brief` tool in x3d_mcp, and the Observatory.

## Known limits

- The injection lint is a pre-filter. On the one hostile test scene the first-draft lint missed one of four planted phrases; two patterns were added with tests. That is a
  single scene, not a detection rate. The layers that hold are: do not send the text; quote it in its own tier; never let a judge's answer authorise anything.
- The state facets are computed from the XML as written: no PROTO expansion, no routes or scripts run, no resolved `Inline`.
- Local facts, supplied labels and imported results stay distinct. This package is not an XSD, semantic or render validator and not a Loom acceptance implementation.
- Wire shapes follow the service's public API reference as read on 2026-11-16; check the live contract before writing a transport, which is also why
  `confidence_mismatch` audits the reported value instead of trusting it. A pinned id and typed JSON establish neither semantic correctness nor calibration.

## Licences

Standard library only, so nothing third party ships here and there is no NOTICE file. Fixtures (`fixtures/adversarial.x3d`, `fixtures/benign.x3d`) were written for
this folder, and `adversarial.x3d` carries instruction-like strings as inert test data; scenes from other repositories are referenced by sha256 and origin in the receipts and are
not copied. Pytest (MIT) is a test-time tool, not a dependency of the package.
