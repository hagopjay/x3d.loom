import pytest

from x3d_s1.questions import ChoiceAnswer, NoulAnswer, ScoreAnswer
from x3d_s1.routing import ACT, CHECK, ESCALATE, SUSPECTED_OK, ESCALATE_ORACLE, DEFER_HUMAN, ActionPolicy, Policy, route_choice, route_noul, route_score, screen


def ans(p, option="fix"):
    other = (1 - p)
    return ChoiceAnswer(option, {option: p, "other": other}, 0.0)


POL = Policy(floor=0.5, actions={"auto_fix": ActionPolicy("auto_fix", "medium", 0.9), "delete": ActionPolicy("delete", "irreversible", 0.99, never_auto=True),
                                  "tag": ActionPolicy("tag", "low", 0.6)})


def test_threshold_is_per_action_not_global():
    assert route_choice(ans(0.8, "tag"), POL).outcome == ACT
    assert route_choice(ans(0.8, "auto_fix"), POL).outcome == CHECK
    assert route_choice(ans(0.95, "auto_fix"), POL).outcome == ACT


def test_floor_escalates_whatever_the_action():
    assert route_choice(ans(0.4, "tag"), POL).outcome == ESCALATE


def test_irreversible_never_reaches_act():
    d = route_choice(ans(0.999, "delete"), POL)
    assert d.outcome == CHECK and d.bar == 1.0


def test_route_names_are_the_loom_s_grade_routes_never_pass_or_fail():
    assert (SUSPECTED_OK, ESCALATE_ORACLE, DEFER_HUMAN) == ("suspected_ok", "escalate_oracle", "defer_human")
    names = {route_choice(ans(p, a), POL).outcome for p in (0.3, 0.8, 0.999) for a in ("tag", "auto_fix", "delete")}
    assert names <= {SUSPECTED_OK, ESCALATE_ORACLE, DEFER_HUMAN} and not names & {"pass", "fail", "act"}


def test_decision_carries_its_numbers():
    d = route_choice(ans(0.8, "auto_fix"), POL).to_dict()
    assert d["p"] == 0.8 and d["bar"] == 0.9 and d["floor"] == 0.5 and d["option"] == "auto_fix"


def test_noul_has_an_unsure_band_and_is_never_rounded():
    assert route_noul(NoulAnswer(0.71)) == "yes" and route_noul(NoulAnswer(0.29)) == "no"
    assert route_noul(NoulAnswer(0.5)) == "unsure" and route_noul(NoulAnswer(0.7)) == "unsure" and route_noul(NoulAnswer(0.3)) == "unsure"
    with pytest.raises(ValueError):
        route_noul(NoulAnswer(0.5), yes=0.3, no=0.7)


def test_screen_runs_expensive_step_only_on_clear_yes():
    assert [screen(NoulAnswer(v)) for v in (0.9, 0.5, 0.1)] == ["run", "cheap", "skip"]


def test_score_spread_goes_to_a_person():
    spread = ScoreAnswer(2.0, {0: 0.5, 1: 0.0, 2: 0.0, 3: 0.0, 4: 0.5}, 0.0)
    tight = ScoreAnswer(3.9, {0: 0.0, 1: 0.0, 2: 0.0, 3: 0.1, 4: 0.9}, 0.9)
    assert route_score(spread, [1.5, 3.0]) == ESCALATE
    assert route_score(tight, [1.5, 3.0]) == "band2"
