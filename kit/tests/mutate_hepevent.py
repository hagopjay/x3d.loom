"""Mutation pass over kit/loomkit/hepevent.py: disable one need(...) site at a time, run the hepevent suite (child mode,
normal Python), count the mutants the suite catches.

  python3 -I kit/tests/mutate_hepevent.py . OUTDIR [workers]     # last run: kit/tests/hepevent-mutation-last-run.json

Limit: it disables the raising predicates only, not thresholds or the arithmetic inside them."""
import json, re, shutil, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
repo, out = Path(sys.argv[1]), Path(sys.argv[2]); workers = int(sys.argv[3]) if len(sys.argv) > 3 else 4
src = (repo / "kit/loomkit/hepevent.py").read_text()
sites = [m.start() for m in re.finditer(r"(?<![\w.])need\(", src)]
def line_of(pos): return src.count("\n", 0, pos) + 1
def run(i):
    pos = sites[i]
    mutant = src[:pos] + "(lambda *a, **k: None)(" + src[pos + len("need("):]
    with tempfile.TemporaryDirectory(prefix="mut-") as d:
        kit = Path(d) / "kit"
        shutil.copytree(repo / "kit", kit, ignore=shutil.ignore_patterns("__pycache__"))
        (kit / "loomkit/hepevent.py").write_text(mutant)
        p = subprocess.run([sys.executable, "-I", str(kit / "tests/test_hepevent.py"), "--child"], capture_output=True, text=True, timeout=600)
        caught = p.returncode != 0
        why = (p.stderr.strip().splitlines() or [""])[-1][:200]
    return {"site": i, "line": line_of(pos), "caught": caught, "why": why}
with ThreadPoolExecutor(workers) as ex:
    res = list(ex.map(run, range(len(sites))))
surv = [r for r in res if not r["caught"]]
out.mkdir(parents=True, exist_ok=True)
(out / "mutation.json").write_text(json.dumps({"sites": len(sites), "caught": len(sites) - len(surv), "survivors": surv, "all": res}, indent=1))
print(json.dumps({"sites": len(sites), "caught": len(sites) - len(surv), "survivors": [(r["line"]) for r in surv]}))
