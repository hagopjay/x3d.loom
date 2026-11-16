"""x3d_s1: typed System-One judgments for X3D, as ordinary code.

The model of work (the typed-question idea, re-grounded in X3D's exact oracles; see x3d.docs chapter 22):

* a *question* has a closed answer space declared before anything is asked (Choice, Score, Noul);
* an *answer* is parsed against that space, so an out-of-space value cannot enter the program;
* a *state* is sliced per question, with a trust tier on every field, so free text from a scene
  never reaches a judge unless a caller opts in, and then only quoted, capped and linted;
* a *policy* turns probabilities into suspected_ok / escalate_oracle / defer_human, per action, in reviewed code;
* *calibration* and *consistency* are measured against exact outcomes (the validator, a gate),
  never assumed;
* decidable questions are answered by code first ("lookup before judge").

No network access and no model call lives in this package. `HostedAdapter` builds the documented request
and parses the typed response, but the HTTP step is an injected callable; the shipped backends are
deterministic (replay, stub). Wiring a real client is a deliberate step for the caller.
"""
from .questions import (Choice, Score, Noul, ChoiceAnswer, ScoreAnswer, NoulAnswer, AnswerSpaceError,
                        parse_answer, with_companion, CHOICE_MAX_OPTIONS, SCORE_MIN_LEVELS, SCORE_MAX_LEVELS)
from .confidence import (choice_confidence, score_confidence, noul_confidence, top_probability, top_to_second)

__version__ = "0.1.0"
