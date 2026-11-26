# usage: python -I run_fork.py FORK MODE OUT.json scene...   MODE = A (semantic_diagnostics) | B (with files)
import json, sys, time, platform, subprocess, os
fork, mode, outp = sys.argv[1], sys.argv[2], sys.argv[3]
sys.path.insert(0, fork); sys.path.insert(1, fork + "/src")
from src.validation.validate import validate_xml
from src.validation import semantic
commit = subprocess.run(["git", "-C", fork, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
out = {"fork_commit": commit, "mode": mode, "python": platform.python_version(), "lxml": __import__("lxml").__version__, "files": {}}
for p in sys.argv[4:]:
    text = open(p, encoding="utf-8").read()
    t0 = time.perf_counter(); g = validate_xml(text); tg = time.perf_counter() - t0
    t0 = time.perf_counter()
    try:
        if mode == "B":
            d = semantic.semantic_diagnostics_with_files(text, os.path.dirname(os.path.abspath(p)))
        else:
            d = semantic.semantic_diagnostics(text)
        diags = [dict(x.__dict__) for x in d]; err = None
    except Exception as e:
        diags, err = [], f"{type(e).__name__}: {e}"
    ts = time.perf_counter() - t0
    out["files"][p] = {"xsd_valid": bool(g.get("valid")), "xsd_errors": len(g.get("errors") or []),
                       "diagnostics": diags, "instrument_error": err, "t_xsd_s": round(tg, 3), "t_sem_s": round(ts, 3)}
json.dump(out, open(outp, "w"), indent=1, default=str)
print(commit[:7], mode, len(out["files"]))
