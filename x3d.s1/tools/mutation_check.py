"""Plant bugs in a scratch copy of the package; every mutant must turn the test suite red.

A crash, a missing mutation target or a mutant that survives counts as a FAILURE of this check. Run from x3d.s1:
    python3 -B tools/mutation_check.py            (needs pytest on the path; the package itself needs nothing)
Preserves the supplied historical receipt. Writes receipts/mutation-hardening.json.
"""
import ast
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

sys.dont_write_bytecode = True
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MUTANTS = [
    ("calibration.py", "ECE bin weight uses N-1", "sum(b.n / n * abs(b.freq - b.mean_p)", "sum(b.n / (n - 1) * abs(b.freq - b.mean_p)"),
    ("calibration.py", "Brier sign flipped", "return sum((p - o) ** 2 for p, o in zip(probs, outcomes)) / len(probs)", "return sum((p + o) ** 2 for p, o in zip(probs, outcomes)) / len(probs)"),
    ("calibration.py", "threshold uses point precision, not lower bound", "if lo >= target:", "if sum(sel) / len(sel) >= target:"),
    ("calibration.py", "Wilson z dropped", "d = 1 + z * z / n", "d = 1 + z / n"),
    ("calibration.py", "bin edge: 1.0 not in last bin", "or (b == bins - 1 and p == 1.0)", ""),
    ("confidence.py", "Choice confidence ignores 1/n", "return (max(q) - 1.0 / n) / (1.0 - 1.0 / n)", "return (max(q) - 0.0) / (1.0 - 0.0)"),
    ("confidence.py", "Score confidence floor removed", "return max(0.0, 1.0 - spread / even)", "return 1.0 - spread / even"),
    ("routing.py", "floor ignored", "if p < policy.floor:", "if p < 0.0:"),
    ("routing.py", "irreversible actions allowed to act", "if pol.never_auto:", "if False:"),
    ("routing.py", "noul unsure band collapsed", "if answer.noul > yes:", "if answer.noul >= no:"),
    ("questions.py", "choice limit off by one", "CHOICE_MAX_OPTIONS = 255", "CHOICE_MAX_OPTIONS = 256"),
    ("questions.py", "probability sum tolerance widened", "PROB_SUM_TOL = 0.02", "PROB_SUM_TOL = 0.5"),
    ("untrusted.py", "withhold switched off", "if flags and withhold_flagged:", "if False:"),
    ("untrusted.py", "NFKC normalisation dropped from lint", "norm = unicodedata.normalize(\"NFKC\", s)", "norm = s"),
    ("state.py", "untrusted tier included by default", "dropped_untrusted = [f for f in want if FACETS[f][1] == \"untrusted\"] if not include_untrusted else []", "dropped_untrusted = []"),
    ("state.py", "entity check removed", "if _ENTITY.search(data):", "if False:"),
    ("state.py", "script bodies quoted", "rec.pop(\"text\", None); rec[\"withheld\"] = True", "rec[\"text\"] = body; rec[\"withheld\"] = True"),
    ("decidable.py", "one-hot answer not one-hot", "\"probabilities\": {o: 1.0 if o == v else 0.0 for o in q.options}", "\"probabilities\": {o: 1.0 if o == v else 0.1 for o in q.options}"),
    ("backends.py", "alias pinning removed", "        _require_pinned_model(model)\n", "        pass  # mutation: bypass the pin guard\n"),
    ("evidence.py", "FIND matches the first word only", "if [t[0] for t in toks[i:i + len(words)]] == words:", "if toks[i][0] == words[0]:"),
    ("evidence.py", "fold keeps control characters", "        if _CTRL.match(ch):\n            continue\n", "        if False:\n            continue\n"),
    ("evidence.py", "fold drops case folding", "for c in unicodedata.normalize(\"NFKC\", ch).casefold():", "for c in unicodedata.normalize(\"NFKC\", ch):"),
    ("evidence.py", "thousands reading dropped", "if len(b) == 3 and re.fullmatch(r\"[1-9]\\d{0,2}\", a):", "if False:"),
    ("evidence.py", "numeric mismatch softened to reworded", "        if numeric:\n            return \"check\"\n        return \"check\" if policy.reworded_is_problem else \"reworded\"", "        return \"check\" if policy.reworded_is_problem else \"reworded\""),
    ("evidence.py", "vector order ignored", "win = qn[i:i + len(vals)]", "win = qn[i:i + len(vals)][::-1]"),
    ("evidence.py", "lint not run on quotes", "flags = tuple(lint_text(quote)) if policy.lint_quotes else ()", "flags = ()"),
    ("evidence.py", "cap loosens routes", "return route if _SEVERITY[route] >= _SEVERITY[floor] else floor", "return floor"),
    ("evidence.py", "verified claim graded C", "CLAIM_GRADE_CAP = {\"verified\": \"L\"", "CLAIM_GRADE_CAP = {\"verified\": \"C\""),
    ("evidence.py", "check verdict floors at escalate_oracle", "\"check\": DEFER_HUMAN}", "\"check\": ESCALATE_ORACLE}"),
    ("evidence.py", "moved quote verifies by default", "moved_is_check: bool = True", "moved_is_check: bool = False"),
    ("evidence.py", "minimum quote length ignored", "or nwords < policy.min_quote_words:", ":"),
    ("evidence.py", "ambiguous reading never flagged strict", "if ambiguous and policy.ambiguous_is_check:", "if False:"),
    ("evidence.py", "wire view carries flagged quote text", "d[\"quote\"] = quote_untrusted(ev.quote, cap) if ev.quote else None", "d[\"quote\"] = {\"trust\": \"untrusted\", \"text\": ev.quote} if ev.quote else None"),
    ("evidence.py", "receipt carries quote text", "d[\"quote\"] = {\"sha256_12\": hashlib.sha256(ev.quote.encode(\"utf-8\", \"replace\")).hexdigest()[:12], \"chars\": len(ev.quote)} if ev.quote else None", "d[\"quote\"] = ev.quote"),
    ("evidence.py", "review snippet not escaped", "esc = lambda t: html.escape(_visible(t), quote=True)", "esc = lambda t: t"),
    ("evidence.py", "verified coverage counts any quote", "{e.field for e in evs if e.verdict == \"verified\"} & exp", "{e.field for e in evs if e.verdict != \"unchecked\"} & exp"),
    ("evidence.py", "lint skips the string the quote sits in", "flags = tuple(dict.fromkeys(flags + tuple(lint_text(src.text))))", "flags = flags"),
    ("pipeline.py", "evidence cap not applied to a judged route", "e[\"route\"] = cap_route(before, evidence[s.id])", "e[\"route\"] = before"),
    ("evidence.py", "wire view carries the DEF name unmarked", "locus[\"def\"] = quote_untrusted(ev.locus[\"def\"], 40)", "locus[\"def\"] = ev.locus[\"def\"]"),
    ("evidence.py", "hostile tag names kept in node paths", "safe = _SAFE_TAG.fullmatch(ch.tag) and not lint_text(ch.tag)", "safe = True"),
    ("pipeline.py", "judge asked D questions", "if s.cls == D:\n            ans = parse_answer", "if False:\n            ans = parse_answer"),
]

EXPECTED_TESTS = {
    "ECE bin weight uses N-1": ["test_overconfident_has_ece_equal_to_gap"],
    "Brier sign flipped": ["test_proper_scores"],
    "threshold uses point precision, not lower bound": ["test_threshold_uses_lower_bound_not_lucky_bin"],
    "Wilson z dropped": ["test_wilson_known_values"],
    "bin edge: 1.0 not in last bin": ["test_probability_exactly_one_lands_in_the_last_bin"],
    "Choice confidence ignores 1/n": ["test_choice_matches_docs", "test_confidence_is_concentration_not_hit_rate"],
    "Score confidence floor removed": ["test_score_far_split_costs_more_than_adjacent_split"],
    "floor ignored": ["test_floor_escalates_whatever_the_action"],
    "irreversible actions allowed to act": ["test_irreversible_never_reaches_act"],
    "noul unsure band collapsed": ["test_noul_has_an_unsure_band_and_is_never_rounded"],
    "choice limit off by one": ["test_choice_bounds_2_to_255"],
    "probability sum tolerance widened": ["test_out_of_space_answers_cannot_enter_and_name_their_reason", "test_probability_sum_tolerance_is_tight_both_sides"],
    "withhold switched off": ["test_flagged_text_is_withheld", "test_untrusted_questions_skipped_unless_allowed_and_attack_text_never_sent"],
    "NFKC normalisation dropped from lint": ["test_lint_sees_through_fullwidth_forms"],
    "untrusted tier included by default": ["test_untrusted_text_is_excluded_by_default"],
    "entity check removed": ["test_entities_and_oversize_are_refused_before_parsing"],
    "script bodies quoted": ["test_when_included_attacks_are_withheld_and_flagged"],
    "one-hot answer not one-hot": ["test_exact_answers_are_one_hot_and_in_space"],
    "alias pinning removed": ["test_aliases_are_refused_pin_a_version"],
    "FIND matches the first word only": ["test_a_fragment_of_an_attack_is_judged_by_the_string_it_sits_in", "test_a_quote_never_spans_two_sources", "test_find_needs_an_unbroken_run_of_words"],
    "fold keeps control characters": ["test_zero_width_and_fullwidth_characters_do_not_hide_or_fake_a_word"],
    "fold drops case folding": ["test_find_ignores_case_punctuation_and_spacing_and_reports_the_original_span", "test_identifiers_are_case_sensitive_and_ignore_separators", "test_number_in_quote_either_notation_is_verified_with_a_flag_when_it_needed_the_second_reading"],
    "thousands reading dropped": ["test_number_in_quote_either_notation_is_verified_with_a_flag_when_it_needed_the_second_reading", "test_number_readings_european_and_american"],
    "numeric mismatch softened to reworded": ["test_a_printed_number_given_as_text_is_one_number_not_a_pair", "test_a_wrong_number_is_check_never_reworded", "test_cap_only_tightens_a_route_and_each_verdict_has_one_floor"],
    "vector order ignored": ["test_a_printed_number_given_as_text_is_one_number_not_a_pair", "test_sign_and_vector_order_are_kept"],
    "lint not run on quotes": ["test_an_instruction_like_quote_is_flagged_even_when_it_is_not_in_any_source"],
    "cap loosens routes": ["test_cap_only_tightens_a_route_and_each_verdict_has_one_floor"],
    "verified claim graded C": ["test_no_verdict_can_lift_a_claim_to_C"],
    "check verdict floors at escalate_oracle": ["test_cap_only_tightens_a_route_and_each_verdict_has_one_floor", "test_pipeline_caps_a_judged_route_and_leaves_exact_answers_alone"],
    "moved quote verifies by default": ["test_moved_quote_is_check_by_default"],
    "minimum quote length ignored": ["test_no_quote_is_unchecked_not_wrong_and_a_short_quote_is_check"],
    "ambiguous reading never flagged strict": ["test_number_in_quote_either_notation_is_verified_with_a_flag_when_it_needed_the_second_reading"],
    "wire view carries flagged quote text": ["test_wire_view_withholds_a_flagged_quote_and_receipt_carries_no_scene_text"],
    "receipt carries quote text": ["test_cli_evidence_exit_code_follows_the_requirement", "test_pipeline_caps_a_judged_route_and_leaves_exact_answers_alone", "test_wire_view_withholds_a_flagged_quote_and_receipt_carries_no_scene_text"],
    "review snippet not escaped": ["test_review_html_escapes_and_shows_hidden_characters"],
    "verified coverage counts any quote": ["test_coverage_counts_quotes_and_verified_coverage_counts_proof"],
    "lint skips the string the quote sits in": ["test_a_fragment_of_an_attack_is_judged_by_the_string_it_sits_in"],
    "evidence cap not applied to a judged route": ["test_pipeline_caps_a_judged_route_and_leaves_exact_answers_alone"],
    "wire view carries the DEF name unmarked": ["test_a_hostile_def_name_and_tag_never_ride_the_wire_view_unmarked"],
    "hostile tag names kept in node paths": ["test_a_hostile_def_name_and_tag_never_ride_the_wire_view_unmarked"],
    "judge asked D questions": ["test_lookup_before_judge_a_D_question_never_reaches_the_backend", "test_triage_without_backend_answers_D_defers_C_skips_J"],
}


def _copy_project(source, destination):
    # Receipts are input fixtures for the README drift tests. Dropping them used
    # to make every mutant red for an unrelated FileNotFoundError.
    shutil.copytree(source, destination, ignore=shutil.ignore_patterns("__pycache__", ".pytest_cache", ".git", "vendor"))


def snapshot_hash(root):
    digest = hashlib.sha256()
    for parent, dirs, names in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d not in ("__pycache__", ".pytest_cache", ".git", "vendor"))
        for name in sorted(names):
            if name in ("mutation-hardening.json", ".mutation-pytest.xml") or name.endswith(".pyc"):
                continue
            path = os.path.join(parent, name)
            with open(path, "rb") as stream: data = stream.read()
            digest.update(os.path.relpath(path, root).replace(os.sep, "/").encode("utf-8") + b"\0")
            digest.update(str(len(data)).encode("ascii") + b"\0" + data)
    return digest.hexdigest()


def run_tests(pkg_root):
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", PYTHONPATH=pkg_root)
    report = os.path.join(pkg_root, ".mutation-pytest.xml")
    try:
        p = subprocess.run([sys.executable, "-B", "-m", "pytest", "-q", "-p", "no:cacheprovider", "--junitxml", report, os.path.join(pkg_root, "tests")],
                           cwd=pkg_root, env=env, capture_output=True, text=True, timeout=300)
        tree = ET.parse(report)
        failed, errors = [], []
        for case in tree.iter("testcase"):
            name = case.get("classname", "") + "::" + case.get("name", "")
            if case.find("failure") is not None: failed.append(name)
            if case.find("error") is not None: errors.append(name)
        return {"returncode": p.returncode, "failed_tests": failed, "error_tests": errors,
                "tail": (p.stdout + p.stderr)[-1200:]}
    except Exception as exc:
        return {"returncode": None, "failed_tests": [], "error_tests": [], "harness_error": type(exc).__name__ + ": " + str(exc)}
    finally:
        if os.path.exists(report): os.unlink(report)


def classify(run, expected):
    """Only a named behavioral regression can kill a syntactically valid mutant."""
    if run.get("harness_error") or run.get("error_tests") or run.get("returncode") not in (0, 1):
        return "INVALID_RUN"
    if run["returncode"] == 0:
        return "SURVIVED"
    if any(any(anchor in name for anchor in expected) for name in run["failed_tests"]):
        return "killed"
    return "UNRELATED_FAILURE"


def main():
    results = []
    baseline = run_tests(ROOT)
    if baseline["returncode"] != 0:
        print("baseline suite is red; refusing to run mutants")
        return 2
    control_tmp = tempfile.mkdtemp(prefix="s1control-")
    try:
        control_root = os.path.join(control_tmp, "x3d.s1")
        _copy_project(ROOT, control_root)
        control = run_tests(control_root)
        source_hash = snapshot_hash(control_root)
    except Exception:
        shutil.rmtree(control_tmp, ignore_errors=True)
        raise
    if control["returncode"] != 0:
        print("unmutated copied control is red; no mutation result is valid")
        print(control)
        shutil.rmtree(control_tmp, ignore_errors=True)
        return 2
    for fname, label, old, new in MUTANTS:
        tmp = tempfile.mkdtemp(prefix="s1mut-")
        try:
            dst = os.path.join(tmp, "x3d.s1")
            _copy_project(control_root, dst)  # every mutation starts from the same tested snapshot
            target = os.path.join(dst, "x3d_s1", fname)
            with open(target, encoding="utf-8") as fh:
                src = fh.read()
            if src.count(old) != 1:
                results.append({"file": fname, "mutant": label, "result": "MISSING_TARGET", "occurrences": src.count(old)})
                continue
            mutated = src.replace(old, new)
            try:
                ast.parse(mutated, filename=target)
            except SyntaxError:
                results.append({"file": fname, "mutant": label, "result": "INVALID_SOURCE"})
                continue
            with open(target, "w", encoding="utf-8") as fh:
                fh.write(mutated)
            run = run_tests(dst)
            expected = EXPECTED_TESTS[label]
            results.append({"file": fname, "mutant": label, "result": classify(run, expected),
                            "expected_tests": expected, **run})
        except Exception as e:  # a crash counts as a failure of the check
            results.append({"file": fname, "mutant": label, "result": "CRASH", "error": type(e).__name__})
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    killed = sum(1 for r in results if r["result"] == "killed")
    shutil.rmtree(control_tmp, ignore_errors=True)
    out = {"schema": "x3d.s1.mutation-check/2", "mutants": len(MUTANTS), "killed": killed, "results": results,
           "baseline": baseline, "copied_control": control, "python": sys.version.split()[0],
           "source_tree_sha256": source_hash,
           "rule": "both controls must pass; valid source must fail a named behavioral regression; unrelated failures, errors, missing targets and survivors fail the check",
           "historical_receipt": "mutation-check.json is preserved and is not evidence for this revised harness"}
    os.makedirs(os.path.join(ROOT, "receipts"), exist_ok=True)
    with open(os.path.join(ROOT, "receipts", "mutation-hardening.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2, sort_keys=True)
        fh.write("\n")
    for r in results:
        print(f"{r['result']:15s} {r['file']:16s} {r['mutant']}")
    print(f"{killed} of {len(MUTANTS)} mutants killed")
    return 0 if killed == len(MUTANTS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
