#!/usr/bin/env python3
"""Fault Court runner.
    python3 run.py build OUT                    write every case in every format (no checker runs)
    python3 run.py check OUT                    run the base checkers on all cases; prints only learn half + clean + decoys,
                                                seals the held-out half in OUT/held-base.json (sha256 printed)
    python3 run.py held OUT                     open the sealed half, run the Loom rules on held + decoys, score everything
"""
import copy, hashlib, json, sys
from pathlib import Path
import court, faults

FMTS = ("x3d", "gltf", "usd")
EXT = {"x3d": "x3d", "gltf": "gltf", "usd": "usda"}


def write_case(c, out):
    res = {}
    for f in FMTS:
        hook = c[f]
        if hook in (faults.NE, faults.NA):
            res[f] = hook
            continue
        s = court.base()
        if c["shared"]:
            c["shared"](s)
        d = out / f
        d.mkdir(parents=True, exist_ok=True)
        (d / "tex.png").write_bytes(court.PNG)
        (d / "notes.png").write_text("these are notes, not an image\n")
        if f == "x3d":
            X = court.x3d_tree(s)
            if hook:
                hook(X)
            text = court.x3d_text(X)
        elif f == "gltf":
            g, a = court.gltf_doc(s)
            if hook:
                hook(g, a)
            text = court.gltf_pack(g, a)
        else:
            u = court.usd_doc(s)
            if hook:
                hook(u)
            text = court.usd_text(u)
        p = d / f"{c['id']}.{EXT[f]}"
        p.write_text(text)
        res[f] = str(p)
    return res


def build(out):
    out.mkdir(parents=True, exist_ok=True)
    clean = dict(id="clean", family="-", title="clean control", shared=None, x3d=None, gltf=None, usd=None, decoy=False)
    man = {}
    for c in [clean] + faults.C:
        man[c["id"]] = {"family": c["family"], "title": c["title"], "decoy": c["decoy"], "files": write_case(c, out)}
    (out / "cases.json").write_text(json.dumps(man, indent=1))
    n = {f: sum(1 for k, v in man.items() if not v["decoy"] and k != "clean" and v["files"][f] not in ("NE", "NA")) for f in FMTS}
    print("built", len(man), "cases; stateable faults per format:", n)
    return man


def check_one(f, path):
    import checks
    if f == "x3d":
        return checks.check_x3d(Path(path).read_text())
    if f == "gltf":
        return checks.check_gltf(path)
    return checks.check_usd(path)


def half(cid):
    return "learn" if cid[0] != "Z" and cid != "clean" and int(cid[1:]) % 2 == 1 else ("held" if cid[0] != "Z" and cid != "clean" else "control")


if __name__ == "__main__":
    cmd, out = sys.argv[1], Path(sys.argv[2])
    if cmd == "build":
        build(out)
    elif cmd == "check":
        man = json.loads((out / "cases.json").read_text())
        R = {}
        for cid, c in man.items():
            R[cid] = {}
            for f in FMTS:
                p = c["files"][f]
                R[cid][f] = {"status": p} if p in ("NE", "NA") else check_one(f, p)
        sealed = {k: v for k, v in R.items() if half(k) == "held"}
        blob = json.dumps(sealed, sort_keys=True).encode()
        (out / "held-base.json").write_bytes(blob)
        (out / "learn-base.json").write_text(json.dumps({k: v for k, v in R.items() if half(k) != "held"}, indent=1))
        print("sealed held-out half:", len(sealed), "cases, sha256", hashlib.sha256(blob).hexdigest())
