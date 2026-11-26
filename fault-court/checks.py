"""Each format's own checkers, strictest settings. Returns findings (severity error|warning) and whether the file loaded."""
import json, subprocess, sys, tempfile, os
from pathlib import Path
import os
MCP = Path(os.environ.get("X3D_MCP", "../x3d_mcp"))
sys.path.insert(0, str(MCP / "src"))
from validation.validate import validate_xml
from validation.semantic import semantic_diagnostics
HERE = Path(__file__).resolve().parent

def check_x3d(text):
    x = validate_xml(text)
    F = [{"tool": "xsd", "sev": "error", "msg": str(e)[:240]} for e in (x.get("errors") or [])]
    try:
        for d in semantic_diagnostics(text):
            if d.level in ("error", "warning"):
                F.append({"tool": "semantic", "sev": d.level, "msg": f"{d.check}: {d.message}"[:240]})
    except Exception as e:
        F.append({"tool": "semantic", "sev": "error", "msg": f"crash {type(e).__name__}: {e}"[:240]})
    return {"loaded": True, "findings": F}

def check_gltf(path):
    r = subprocess.run(["node", str(HERE / "gltf_check.mjs"), str(path)], capture_output=True, text=True, timeout=120)
    try:
        j = json.loads(r.stdout)
    except Exception:
        return {"loaded": False, "findings": [{"tool": "gltf-validator", "sev": "error", "msg": ("crash " + r.stderr)[:240]}]}
    return {"loaded": True, "findings": [{"tool": "gltf-validator", "sev": "error" if m["severity"] == 0 else "warning", "msg": f"{m['code']} {m.get('pointer','')} {m.get('message','')}"[:240]} for m in j["messages"] if m["severity"] <= 1]}

def check_usd(path):
    code = r'''
import sys, json
from pxr import Usd, UsdValidation, UsdUtils, Tf
out = {"loaded": True, "findings": []}
try:
    st = Usd.Stage.Open(sys.argv[1])
except Exception as e:
    print(json.dumps({"loaded": False, "findings": [{"tool": "usd-open", "sev": "error", "msg": str(e)[:240]}]})); sys.exit()
for e in UsdValidation.ValidationContext(UsdValidation.ValidationRegistry().GetOrLoadAllValidators()).Validate(st):
    sev = {UsdValidation.ValidationErrorType.Error: "error", UsdValidation.ValidationErrorType.Warn: "warning"}.get(e.GetType())
    if sev: out["findings"].append({"tool": "UsdValidation:" + e.GetName(), "sev": sev, "msg": e.GetMessage()[:240]})
out["validators"] = len(UsdValidation.ValidationRegistry().GetOrLoadAllValidators())
print(json.dumps(out))
'''
    r = subprocess.run([sys.executable, "-c", code, str(path)], capture_output=True, text=True, timeout=120)
    try:
        j = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception:
        return {"loaded": False, "findings": [{"tool": "usd", "sev": "error", "msg": ("crash " + r.stderr[-300:])}]}
    # USD prints coding errors / warnings for parse problems on stderr: count them as findings of the loader
    for line in r.stderr.splitlines():
        if "Error" in line or "Warning" in line or "Coding" in line:
            j["findings"].append({"tool": "usd-runtime", "sev": "error" if "Error" in line else "warning", "msg": line[:240]})
    return j
