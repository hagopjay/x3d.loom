"""Plant bugs in a scratch copy of the package; every mutant must turn the test suite red.

A crash, a missing mutation target or a mutant that survives counts as a FAILURE of this check. Run from x3d.s1:
    python3 -B tools/mutation_check.py            (needs pytest on the path; the package itself needs nothing)
Writes receipts/mutation-check.json.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

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
    ("backends.py", "alias pinning removed", "if not model or model.endswith(\"latest\") or model.endswith(\"preview\"):", "if not model:"),
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


def run_tests(pkg_root):
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", PYTHONPATH=pkg_root)
    p = subprocess.run([sys.executable, "-B", "-m", "pytest", "-q", "-x", "-p", "no:cacheprovider", os.path.join(pkg_root, "tests")],
                       cwd=pkg_root, env=env, capture_output=True, text=True, timeout=300)
    return p.returncode, (p.stdout + p.stderr)[-400:]


def main():
    results = []
    base_rc, _ = run_tests(ROOT)
    if base_rc != 0:
        print("baseline suite is red; refusing to run mutants")
        return 2
    for fname, label, old, new in MUTANTS:
        tmp = tempfile.mkdtemp(prefix="s1mut-")
        try:
            dst = os.path.join(tmp, "x3d.s1")
            shutil.copytree(ROOT, dst, ignore=shutil.ignore_patterns("__pycache__", ".pytest_cache", "receipts"))
            target = os.path.join(dst, "x3d_s1", fname)
            with open(target, encoding="utf-8") as fh:
                src = fh.read()
            if src.count(old) != 1:
                results.append({"file": fname, "mutant": label, "result": "MISSING_TARGET", "occurrences": src.count(old)})
                continue
            with open(target, "w", encoding="utf-8") as fh:
                fh.write(src.replace(old, new))
            rc, tail = run_tests(dst)
            results.append({"file": fname, "mutant": label, "result": "killed" if rc != 0 else "SURVIVED"})
        except Exception as e:  # a crash counts as a failure of the check
            results.append({"file": fname, "mutant": label, "result": "CRASH", "error": type(e).__name__})
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    killed = sum(1 for r in results if r["result"] == "killed")
    out = {"schema": "x3d.s1.mutation-check/1", "mutants": len(MUTANTS), "killed": killed, "results": results,
           "python": sys.version.split()[0], "rule": "a crash, a missing target or a surviving mutant fails the check"}
    os.makedirs(os.path.join(ROOT, "receipts"), exist_ok=True)
    with open(os.path.join(ROOT, "receipts", "mutation-check.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2, sort_keys=True)
        fh.write("\n")
    for r in results:
        print(f"{r['result']:15s} {r['file']:16s} {r['mutant']}")
    print(f"{killed} of {len(MUTANTS)} mutants killed")
    return 0 if killed == len(MUTANTS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
