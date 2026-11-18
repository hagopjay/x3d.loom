import colorsys, json, math, re, resource, sys
import xml.etree.ElementTree as ET

resource.setrlimit(resource.RLIMIT_CPU, (20, 20))
resource.setrlimit(resource.RLIMIT_AS, (1 << 30, 1 << 30))
job = json.load(sys.stdin)
SAFE = {k: __builtins__.__dict__[k] if hasattr(__builtins__, "__dict__") else __builtins__[k]
        for k in ("len range any all min max sum float int str bool list dict set tuple enumerate zip sorted abs round "
                  "isinstance reversed map filter ValueError Exception True False None").split()}
ns = {"__builtins__": SAFE, "ET": ET, "re": re, "math": math, "colorsys": colorsys}
err, results = None, []
try:
    exec(job["src"], ns)
    fn = ns["trap"]
except Exception as e:  # noqa: BLE001
    fn, err = None, f"{type(e).__name__}: {e}"
for x in job["xmls"]:
    if fn is None:
        results.append(None); continue
    try:
        results.append(bool(fn(ET.fromstring(x))))
    except Exception as e:  # noqa: BLE001
        results.append(None); err = err or f"{type(e).__name__}: {e}"
print(json.dumps({"results": results, "error": err}))
