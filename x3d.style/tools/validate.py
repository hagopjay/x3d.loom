"""Validate compiled style worlds with the x3d_mcp validator (XSD 4.0 + semantic checks).
Usage: python3 tools/validate.py /path/to/x3d_mcp DIR_WITH_X3D [receipt.json]
"""
import collections, glob, hashlib, json, os, subprocess, sys
fork, d = sys.argv[1], sys.argv[2]
out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(d, "validate-receipt.json")
sys.path.insert(0, os.path.join(fork, "src"))
from validation.validate import validate_xml  # noqa: E402
from validation import semantic  # noqa: E402
commit = subprocess.run(["git", "-C", fork, "log", "-1", "--format=%h"], capture_output=True, text=True).stdout.strip()
files = {}
for path in sorted(glob.glob(os.path.join(d, "*.x3d"))):
    s = open(path, encoding="utf-8").read()
    x = validate_xml(s)
    diags = semantic.semantic_diagnostics(s)
    lv = collections.Counter(getattr(g, "level", "?") for g in diags)
    ck = collections.Counter(f"{getattr(g, 'level', '?')}:{getattr(g, 'check', '?')}" for g in diags)
    files[os.path.basename(path)] = {"sha256": hashlib.sha256(s.encode()).hexdigest(), "xsd_valid": x["valid"], "schema": x.get("schema_version"),
                                     "xsd_errors": x["errors"][:8], "semantic_by_level": dict(lv), "semantic_by_check": dict(ck),
                                     "sample": [str(getattr(g, "message", g))[:200] for g in diags if getattr(g, "level", "") != "info"][:6]}
ok = all(f["xsd_valid"] and not f["semantic_by_level"].get("error") for f in files.values())
rec = {"validator": f"x3d_mcp fork {commit} (validation.validate.validate_xml + validation.semantic)", "ok": ok,
       "valid": sum(f["xsd_valid"] for f in files.values()), "files_checked": len(files), "files": files}
json.dump(rec, open(out, "w"), indent=1)
for k, f in files.items():
    print(k.ljust(20), "XSD", f["schema"], "valid" if f["xsd_valid"] else "INVALID", f["semantic_by_level"], f["xsd_errors"][:2], f["sample"][:3])
print("ok", ok, rec["validator"])
