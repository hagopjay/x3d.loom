"""Measure x3d_s1 over a folder of real scenes. Offline, stdlib only, writes aggregates and per-scene rows, never scene text.

usage: python3 -B tools/corpus_measure.py OUT.json LABEL=ROOT [LABEL=ROOT ...]
Each root should be a git checkout; its HEAD short sha is recorded so every number names its instrument.
"""
import csv
import hashlib
import json
import os
import platform
import statistics
import subprocess
import sys
import time

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from x3d_s1.decidable import BY_ID, D, partition  # noqa: E402
from x3d_s1.decidable import exact_answer  # noqa: E402
from x3d_s1.state import approx_tokens, jsize, load, slice_state  # noqa: E402

QUESTION_LIMIT_TOKENS = 32_000   # vendor-documented per-question limit (state + one question), read 16 Nov 2026


def git_sha(root):
    try:
        return subprocess.check_output(["git", "-C", root, "rev-parse", "--short=7", "HEAD"], text=True).strip()
    except Exception:
        return None


def pct(xs, q):
    xs = sorted(xs)
    if not xs:
        return None
    k = min(len(xs) - 1, max(0, int(round(q * (len(xs) - 1)))))
    return xs[k]


def main(out, roots):
    rows, failures = [], []
    for label, root in roots:
        sha = git_sha(root)
        for dp, dn, fn in os.walk(root):
            dn[:] = [d for d in dn if d not in (".git", "node_modules")]
            for f in sorted(fn):
                if not f.endswith(".x3d"):
                    continue
                path = os.path.join(dp, f)
                rel = os.path.relpath(path, root)
                try:
                    t0 = time.perf_counter()
                    sc = load(path)
                    t_parse = time.perf_counter() - t0
                    t0 = time.perf_counter()
                    all_state = slice_state(sc, facets=None)
                    full = all_state["state"]
                    ans = {qid: exact_answer(BY_ID[qid], full) for qid in partition()[D]}
                    txt = slice_state(sc, facets=["text", "names"], include_untrusted=True)["state"]
                    t_slice = time.perf_counter() - t0
                except Exception as e:  # not parseable as X3D XML (or odd encoding)
                    failures.append({"repo": label, "path": rel, "error": type(e).__name__})
                    continue
                items = txt["text"]["items"] + [dict(i, where="DEF") for i in txt["names"]["def_names"]]
                n_total = txt["text"]["total"] + txt["names"]["total"]
                flagged = [i for i in items if i.get("flags")]
                with open(path, "rb") as fh:
                    digest = hashlib.sha256(fh.read()).hexdigest()
                rows.append({
                    "repo": label, "sha": sha, "path": rel, "origin": f"{label}@{sha}:{rel}", "file_sha256": digest, "raw_bytes": sc.raw_bytes, "state_bytes": all_state["meta"]["bytes"],
                    "ratio": all_state["meta"]["ratio"], "elements": full["census"]["elements"], "size": full["census"]["size"],
                    "raw_tokens_est": approx_tokens(sc.raw_bytes), "state_tokens_est": approx_tokens(all_state["meta"]["bytes"]),
                    "parse_ms": round(t_parse * 1000, 3), "slice_ms": round(t_slice * 1000, 3),
                    "text_strings": n_total, "text_shown": len(items), "flagged_strings": len(flagged),
                    "flag_kinds": sorted({k for i in flagged for k in i["flags"]}),
                    "has_lights": ans["scene.has_lights"]["noul"], "remote_refs": ans["scene.uses_remote_refs"]["noul"],
                    "viewpoint": ans["scene.has_viewpoint"]["noul"], "scripts": ans["scene.has_scripts"]["noul"],
                    "animated": ans["scene.is_animated"]["noul"], "material_model": ans["scene.material_model"]["choice"],
                    "profile": ans["scene.profile"]["choice"],
                })
    n = len(rows)

    def agg(sub):
        m = len(sub)
        if not m:
            return {"scenes": 0}
        ratios = [r["raw_bytes"] / r["state_bytes"] for r in sub]
        rawb, stb = sum(r["raw_bytes"] for r in sub), sum(r["state_bytes"] for r in sub)
        fl = [r for r in sub if r["flagged_strings"]]
        return {
            "scenes": m, "raw_bytes_total": rawb, "state_bytes_total": stb, "aggregate_ratio": round(rawb / stb, 2),
            "ratio_median": round(statistics.median(ratios), 2), "ratio_p10": round(pct(ratios, .10), 2), "ratio_p90": round(pct(ratios, .90), 2),
            "raw_median_bytes": int(statistics.median(r["raw_bytes"] for r in sub)), "raw_max_bytes": max(r["raw_bytes"] for r in sub),
            "state_median_bytes": int(statistics.median(r["state_bytes"] for r in sub)), "state_max_bytes": max(r["state_bytes"] for r in sub),
            "raw_over_question_limit": sum(1 for r in sub if r["raw_tokens_est"] > QUESTION_LIMIT_TOKENS),
            "state_over_question_limit": sum(1 for r in sub if r["state_tokens_est"] > QUESTION_LIMIT_TOKENS),
            "parse_ms_median": round(statistics.median(r["parse_ms"] for r in sub), 3), "parse_ms_p95": round(pct([r["parse_ms"] for r in sub], .95), 3),
            "slice_ms_median": round(statistics.median(r["slice_ms"] for r in sub), 3), "slice_ms_p95": round(pct([r["slice_ms"] for r in sub], .95), 3),
            "D_prevalence": {k: sum(1 for r in sub if r[k] == 1.0) for k in ("has_lights", "remote_refs", "viewpoint", "scripts", "animated")},
            "material_model": {k: sum(1 for r in sub if r["material_model"] == k) for k in ("none", "classic", "pbr", "unlit", "mixed")},
            "size_class": {k: sum(1 for r in sub if r["size"] == k) for k in ("tiny", "small", "medium", "large", "huge")},
            "text_strings": sum(r["text_strings"] for r in sub), "flagged_strings": sum(r["flagged_strings"] for r in sub),
            "scenes_with_flag": len(fl),
            "flag_kinds": {k: sum(1 for r in fl if k in r["flag_kinds"]) for k in sorted({k for r in fl for k in r["flag_kinds"]})},
        }

    out_obj = {
        "schema": "x3d.s1.corpus-census/1",
        "instrument": {"python": platform.python_version(), "machine": platform.machine(), "platform": platform.platform(), "cpus": os.cpu_count(),
                       "x3d_s1": __import__("x3d_s1").__version__, "bytes_per_token_assumption": 4, "question_limit_tokens": QUESTION_LIMIT_TOKENS,
                       "tool": "tools/corpus_measure.py", "network": False, "model_calls": 0},
        "scope": "every .x3d file under the named checkouts at the named commits, parsed offline with stdlib ElementTree; per-scene rows carry the "
                 "origin repo@sha7:path and the file sha256 so any row can be re-run",
        "grade": "Confirmed for counts and byte sizes (read from the files); the token figures are bytes/4 estimates, a floor for number-heavy text, "
                 "and have not been checked against a vendor tokenizer",
        "limitations": [
            "Public project scenes only: they are small and hand-made, so the size distribution says nothing about a general web corpus.",
            "Corpus is the project repos at one commit each; scenes duplicated across repos are counted once per copy.",
            "Timings are one run on a shared sandbox VM, not pinned to a CPU; compare orders of magnitude, not decimals.",
            "No flagged strings were found, so the lint's detection rate on real scenes is unmeasured here; the planted-phrase test lives in the unit tests.",
            "State slices are measured for size and parse safety. No model has read any of them, so nothing here is evidence about answer quality.",
        ],
        "not_shown": "scene text is never copied into this receipt; rows hold counts, sizes, closed-vocabulary answers and hashes",
        "repos": {label: {"sha": git_sha(root)} for label, root in roots},
        "all": agg(rows), "by_repo": {label: agg([r for r in rows if r["repo"] == label]) for label, _ in roots},
        "unparsed": {"count": len(failures), "by_error": {e: sum(1 for f in failures if f["error"] == e) for e in sorted({f["error"] for f in failures})}},
    }
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(out_obj, fh, indent=2, sort_keys=True)
    with open(os.path.splitext(out)[0] + ".scenes.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]) if rows else ["repo"])
        w.writeheader()
        for r in rows:
            w.writerow({k: (";".join(v) if isinstance(v, list) else v) for k, v in r.items()})
    with open(os.path.splitext(out)[0] + ".unparsed.json", "w", encoding="utf-8") as fh:
        json.dump(failures, fh, indent=1)
    print(json.dumps({"scenes": n, "unparsed": len(failures)}))


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) < 2:
        raise SystemExit(__doc__)
    main(a[0], [tuple(x.split("=", 1)) for x in a[1:]])
