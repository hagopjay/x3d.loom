#!/usr/bin/env python3
"""Pack a week's sweep for the repository: merge the small and large batches in file-list order, replace machine paths,
and name each file as week:<repository>/<path>. Usage: pack_week.py WORK_DIR ADDON_VERSION OUT_DIR

If WORK_DIR/stages/import-only-<version>.jsonl exists, its rows replace the importer's rows for those files. The sweep
driver asks for import followed by export in one call, so a file whose EXPORT gave no answer in time was first stamped
as an importer failure; tools/import_only.py re-asks the importer alone and those answers are the ones packed (each
carries "asked": "import alone"). Every other importer row's 'seconds' is import plus export."""
import json, re, sys
from pathlib import Path

work, ver, out = Path(sys.argv[1]).resolve(), sys.argv[2], Path(sys.argv[3])
order = [l.strip() for l in (work / "files.txt").read_text().splitlines() if l.strip()]
prefix = str(work / "repos") + "/"
out.mkdir(parents=True, exist_ok=True)
for inst in ("import", "reexport", "x3dpy"):
    rows = {}
    for batch in ("small", "large"):
        p = work / f"{batch}-{ver}-{inst}.jsonl"
        for l in p.read_text().splitlines():
            r = json.loads(l); rows[r["file"]] = r
    alone = work / "stages" / f"import-only-{ver}.jsonl"
    if inst == "import" and alone.exists():
        for l in alone.read_text().splitlines():
            r = json.loads(l)
            assert rows[r["file"]]["signature"].startswith("no answer in"), r["file"]
            rows[r["file"]] = r
    missing = [f for f in order if f not in rows]
    assert not missing, (inst, len(missing))
    lines = []
    for f in order:
        assert f.startswith(prefix), f
        r = dict(rows[f]); r["file"] = "week:" + f[len(prefix):]
        t = json.dumps(r)
        t = re.sub(r"/home/[^\"\\ ]*?/src/[0-9.]+/source/", "<addon>/", t)
        t = re.sub(r"/home/[^\"\\ ]*?/x3d-blender-io/", "<x3d-blender-io>/", t)
        t = re.sub(r"/home/[^\"\\ ]*?/site-packages/", "<site-packages>/", t)
        t = re.sub(r"(/)?tmp/(chaos-addon|r2r-oracle)-[A-Za-z0-9_]+/", "<tmp>/", t)
        assert "/home/" not in t and "/tmp/" not in t, t[:300]
        lines.append(t)
    (out / f"{ver}-{inst}.jsonl").write_text("\n".join(lines) + "\n")
    c = {}
    for f in order:
        c[rows[f]["outcome"]] = c.get(rows[f]["outcome"], 0) + 1
    print(inst, len(lines), c)
