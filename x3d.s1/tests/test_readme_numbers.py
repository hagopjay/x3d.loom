"""The numbers in the README are the numbers in the receipts (a drift test, as LESSONS 19 asks)."""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(*p):
    with open(os.path.join(ROOT, *p), encoding="utf-8") as fh:
        return fh.read()


import pytest


@pytest.mark.parametrize("receipt", ["corpus-current.json", "corpus-2026-11-16.json"])
def test_corpus_numbers_in_readme_match_the_receipt(receipt):
    r = json.load(open(os.path.join(ROOT, "receipts", receipt), encoding="utf-8"))
    a, text = r["all"], read("README.md")
    wanted = [f"{a['scenes']} public scenes", f"{a['raw_bytes_total']:,}", f"{a['state_bytes_total']:,}", f"{a['aggregate_ratio']}x",
              f"median ratio {a['ratio_median']}", f"p10 {a['ratio_p10']}", f"p90 {a['ratio_p90']}", f"median state {a['state_median_bytes']:,} B",
              f"largest {a['state_max_bytes']:,} B", f"{a['raw_over_question_limit']} scenes over", f"{a['state_over_question_limit']} sliced",
              f"{a['text_strings']:,} text strings", f"{a['flagged_strings']} flagged", f"slice median {a['slice_ms_median']} ms"]
    missing = [w for w in wanted if w not in text]
    assert missing == [], f"README disagrees with the receipt on: {missing}"


def test_mutation_numbers_in_readme_match_the_receipt():
    r = json.load(open(os.path.join(ROOT, "receipts", "mutation-hardening.json"), encoding="utf-8"))
    text = read("README.md")
    assert r["schema"] == "x3d.s1.mutation-check/2" and r["killed"] == r["mutants"], "a surviving mutant must be fixed, not documented"
    assert all(x["result"] == "killed" and x["failed_tests"] for x in r["results"]), "every kill needs a named failing test"
    assert f"plants {r['mutants']} bugs" in text and f"{r['mutants']} planted bugs, {r['killed']} killed" in text


def test_readme_test_count_matches_collected_tests():
    n = 0
    for f in os.listdir(os.path.join(ROOT, "tests")):
        if f.startswith("test_") and f.endswith(".py"):
            src = read("tests", f)
            n += len(re.findall(r"^def test_", src, flags=re.M))
    # parametrized tests expand, so the README count may be larger than the number of test functions but never smaller
    m = re.search(r"# (\d+) tests", read("README.md"))
    assert m and int(m.group(1)) >= n
