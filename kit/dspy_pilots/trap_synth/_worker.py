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
for x in job["xmls"]:                       # fresh namespace per scene: no state survives from one scene to the next
    ns = {"__builtins__": SAFE, "ET": ET, "re": re, "math": math, "colorsys": colorsys}
    try:
        exec(job["src"], ns)
        results.append(bool(ns["trap"](ET.fromstring(x))))
    except Exception as e:  # noqa: BLE001
        results.append(None); err = err or f"{type(e).__name__}: {e}"
print(json.dumps({"results": results, "error": err}))
