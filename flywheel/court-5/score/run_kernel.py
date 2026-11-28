#!/usr/bin/env python3
"""Run one x3d_mcp checkout over the file-only copies of a court 5 set.

    python3 flywheel/court-5/score/run_kernel.py <x3d_mcp dir> <stripped sets dir> <out.json>

<stripped sets dir> is what intent/strip_intent.py wrote, never the folder with the intent lines in it. Every
set-*/ folder is run. Each scene gets the X3D 4.0 XSD (validate_xml) and the semantic checks with its own folder
to hand (semantic_diagnostics_with_files), so that an address that finds no file can be seen. A kernel too old to
have that entry point is run on the text alone, and the record says so.
"""
import glob, hashlib, json, os, subprocess, sys

mcp, sets, out = sys.argv[1:4]
sys.path.insert(0, mcp + "/src")
from validation.validate import validate_xml  # noqa: E402
from validation import semantic  # noqa: E402

with_files = getattr(semantic, "semantic_diagnostics_with_files", None)
git = lambda *a: subprocess.run(["git", "-C", mcp, *a], capture_output=True, text=True).stdout.strip()
src = sorted(glob.glob(f"{mcp}/src/validation/*.py"))
R = {"kernel": git("rev-parse", "HEAD"), "dirty": bool(git("status", "--porcelain", "--", "src")),
     "reads_the_folder": bool(with_files),
     "src_sha256": {os.path.basename(f): hashlib.sha256(open(f, "rb").read()).hexdigest() for f in src},
     "files": {}}
for folder in sorted(glob.glob(f"{sets}/set-*")):
    s = os.path.basename(folder)[4:]
    for x in sorted(glob.glob(f"{folder}/*.x3d")):
        t = open(x, encoding="utf-8").read()
        if 'name="intent' in t.split("<Scene")[0] or "name='intent" in t.split("<Scene")[0]:
            sys.exit(f"{x} still carries intent lines: run intent/strip_intent.py first")
        try:
            v = validate_xml(t)
            xsd = {k: v.get(k) for k in ("valid", "errors", "error") if k in v}
        except Exception as e:
            xsd = {"exception": repr(e)}
        try:
            ds = with_files(t, folder) if with_files else semantic.semantic_diagnostics(t)
            sem = [dict(level=d.level, check=d.check, message=d.message, node=d.node_tag, DEF=d.def_name) for d in ds]
        except Exception as e:
            sem = [dict(level="exception", check="run", message=repr(e), node="", DEF="")]
        R["files"][f"{s}/{os.path.basename(x)}"] = dict(xsd=xsd, semantic=sem)
json.dump(R, open(out, "w"), indent=1, default=str)
print(out, R["kernel"][:7], "dirty" if R["dirty"] else "clean", "with folder" if with_files else "text only", len(R["files"]), "files")
