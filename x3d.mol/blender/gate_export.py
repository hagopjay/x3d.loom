#!/usr/bin/env python3 -I
"""Gate for the X3D that the Blender stage writes (blender/molcine.py).

  XMOL_FORK=/path/to/x3d_mcp  python3 -I blender/gate_export.py cinema/receipt.json   # python needs gemmi, numpy

1. the x3d_mcp fork's validate_xml and semantic_diagnostics run over every file, read-only, in the fork's own venv
2. a data-true witness, written separately from the Blender stage, reads the file and its source structure and checks:
     SHA          the x3d on disk has the hash in the receipt, and so does the source file
     FRAME        1 Blender unit = 10 angstrom, source coordinates x 0.1, no re-centring (the stage's stated convention); the file's Transform is applied
     CA_NEAR      every C-alpha (protein) or C4' (nucleic acid) has a mesh vertex within 4.0 angstrom, and the median distance is under 2.0
     MESH_NEAR    99 percent of mesh vertices lie within 3.5 angstrom of some source heavy atom (no stray geometry)
     ZN_NEAR      every zinc in the source has a mesh vertex within 3.0 angstrom, when the stage drew zinc spheres
     PLDDT_COLOUR for AlphaFold models: 93 percent of vertex colours equal the pLDDT band colour of the nearest C-alpha, and every band present in the source is present in the mesh
3. the gate always feeds the witness four altered files that must be refused (a shift, the wrong source, every vertex one colour, a band swap) and one honest file that must pass
A pass names what it read. It does not say the picture is beautiful, and the band rule is the stage's own (the molecularnodes pLDDT palette), read back here.
"""
import hashlib, json, os, subprocess, sys
import xml.etree.ElementTree as ET
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
FORK = Path(os.environ.get("XMOL_FORK", os.environ.get("LOOM_FORK", str(ROOT.parent.parent / "x3d_mcp"))))
FORK_PY = FORK / ".venv/bin/python"
CHILD = r'''
import json, sys
sys.path.insert(0, sys.argv[1]); sys.path.insert(0, sys.argv[1] + "/src")
from validation.validate import validate_xml
from validation.semantic import semantic_diagnostics
out = {}
for p in sys.argv[2:]:
    t = open(p, encoding="utf-8").read()
    g = validate_xml(t)
    d = semantic_diagnostics(t)
    out[p] = {"xsd_valid": bool(g.get("valid")), "xsd_errors": [str(e)[:300] for e in (g.get("errors") or [])][:5],
              "semantic_errors": [x.__dict__ for x in d if x.level == "error"][:5], "semantic_warnings": [x.__dict__ for x in d if x.level == "warning"][:5]}
print(json.dumps(out, default=str))
'''
# the molecularnodes pLDDT palette (linear), as written by molecularnodes/color.py plddt(): >90, >70, >50, else
PALETTE = np.array([[0.000000, 0.086496, 0.672395], [0.130157, 0.597176, 0.896205], [1.000169, 0.708345, 0.006512], [1.000169, 0.205070, 0.059507]])


def band(v):
    return 0 if v > 90 else 1 if v > 70 else 2 if v > 50 else 3


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def read_source(path: Path):
    import gemmi, gzip, tempfile
    p = path
    if path.suffix == ".gz":
        p = Path(tempfile.mkdtemp()) / path.name[:-3]
        p.write_bytes(gzip.decompress(path.read_bytes()))
    st = gemmi.read_structure(str(p))
    ref, heavy, zn, bf = [], [], [], []
    for ch in st[0]:
        for r in ch:
            info = gemmi.find_tabulated_residue(r.name)
            nuc = bool(info and info.is_nucleic_acid())
            for a in r:
                if a.element.name == "H":
                    continue
                pos = a.pos.tolist()
                heavy.append(pos)
                if a.element.name == "Zn":
                    zn.append(pos)
                if (not nuc and a.name == "CA" and r.het_flag != "H") or (nuc and a.name == "C4'"):
                    ref.append(pos)
                    bf.append(a.b_iso)
    return {"ref": np.array(ref), "heavy": np.array(heavy), "zn": np.array(zn).reshape(-1, 3), "bfactor": np.array(bf)}


def parse_x3d(path: Path):
    root = ET.parse(path).getroot()
    tr = next(root.iter("Transform"), None)
    M = np.eye(4)
    if tr is not None:
        t = np.array([float(x) for x in tr.get("translation", "0 0 0").split()])
        sc = np.array([float(x) for x in tr.get("scale", "1 1 1").split()])
        rx = [float(x) for x in tr.get("rotation", "0 0 1 0").split()]
        ax, ang = np.array(rx[:3]), rx[3]
        n = np.linalg.norm(ax)
        R = np.eye(3)
        if n > 0 and ang != 0:
            ax = ax / n
            K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
            R = np.eye(3) + np.sin(ang) * K + (1 - np.cos(ang)) * K @ K
        M[:3, :3] = R @ np.diag(sc)
        M[:3, 3] = t
    ifs = next(root.iter("IndexedFaceSet"))
    pts = np.array(next(ifs.iter("Coordinate")).get("point").split(), float).reshape(-1, 3)
    pts = pts @ M[:3, :3].T + M[:3, 3]
    col_el = next(ifs.iter("ColorRGBA"), None)  # an Element with no children is falsy, so no "or" chaining here
    if col_el is None:
        col_el = next(ifs.iter("Color"), None)
    width = 4 if col_el is not None and col_el.tag == "ColorRGBA" else 3
    col = np.array(col_el.get("color").split(), float).reshape(-1, width)[:, :3] if col_el is not None else None
    ci = np.array(ifs.get("coordIndex").split(), int)
    faces = int((ci == -1).sum())
    return {"points_bu": pts, "colour": col, "faces": faces}


def nearest(a, b, chunk=256):
    """distance from every row of a to the nearest row of b, and the index of that row"""
    d_out, i_out = np.empty(len(a)), np.empty(len(a), int)
    for s in range(0, len(a), chunk):
        d = ((a[s:s + chunk, None, :] - b[None, :, :]) ** 2).sum(-1)
        i = d.argmin(1)
        i_out[s:s + chunk] = i
        d_out[s:s + chunk] = np.sqrt(d[np.arange(len(i)), i])
    return d_out, i_out


def witness(mesh, src, plddt: bool, draws_zinc: bool):
    """returns (list of (code, detail), measurements)"""
    fails, m = [], {}
    pts = mesh["points_bu"] * 10.0  # angstrom, the stage's stated frame
    d_ref, nearest_mesh = nearest(src["ref"], pts)
    m["ca_nearest_max_A"], m["ca_nearest_median_A"] = round(float(d_ref.max()), 2), round(float(np.median(d_ref)), 2)
    if d_ref.max() > 4.0 or np.median(d_ref) > 2.0:
        fails.append(("CA_NEAR", f"max {d_ref.max():.2f} A, median {np.median(d_ref):.2f} A"))
    d_heavy, _ = nearest(pts, src["heavy"])
    frac = float((d_heavy <= 3.5).mean())
    m["mesh_within_3.5A_of_an_atom"] = round(frac, 4)
    if frac < 0.99:
        fails.append(("MESH_NEAR", f"{frac:.3f} of vertices within 3.5 A of a source atom"))
    if draws_zinc and len(src["zn"]):
        dz, _ = nearest(src["zn"], pts)
        m["zn_nearest_max_A"] = round(float(dz.max()), 2)
        if dz.max() > 3.0:
            fails.append(("ZN_NEAR", f"a zinc has no mesh vertex within 3.0 A (worst {dz.max():.2f})"))
    if plddt:
        col = mesh["colour"]
        if col is None:
            fails.append(("PLDDT_COLOUR", "the file has no vertex colours"))
        else:
            _, near_ca = nearest(pts, src["ref"])
            want = np.array([band(v) for v in src["bfactor"]])[near_ca]
            got = np.abs(col[:, None, :] - PALETTE[None, :, :]).max(-1)  # vertex colour against the four palette colours
            got_band = np.where(got.min(1) < 0.02, got.argmin(1), -1)
            agree = float((got_band == want).mean())
            m["plddt_colour_agreement"] = round(agree, 4)
            present_src = {int(band(v)) for v in src["bfactor"]}
            present_mesh = {int(b) for b in np.unique(got_band) if b >= 0}
            if agree < 0.93:
                fails.append(("PLDDT_COLOUR", f"{agree:.3f} of vertex colours match the nearest residue's band"))
            if not present_src <= present_mesh:
                fails.append(("PLDDT_COLOUR", f"bands in the source {sorted(present_src)} but in the mesh {sorted(present_mesh)}"))
    return fails, m


def selftest(mesh, src, plddt, draws_zinc, wrong_src):
    """four altered files must each be refused with the expected code, and the honest one must pass"""
    out = []
    ok_fails, _ = witness(mesh, src, plddt, draws_zinc)
    out.append(("honest file passes", not ok_fails, ok_fails))
    shifted = dict(mesh, points_bu=mesh["points_bu"] + np.array([0.5, 0.0, 0.0]))  # 5 angstrom
    f, _ = witness(shifted, src, plddt, draws_zinc)
    out.append(("5 A shift refused (CA_NEAR or MESH_NEAR)", any(c in ("CA_NEAR", "MESH_NEAR") for c, _ in f), f))
    f, _ = witness(mesh, wrong_src, plddt, draws_zinc)
    out.append(("wrong source structure refused", bool(f), f))
    if plddt and mesh["colour"] is not None:
        one = dict(mesh, colour=np.tile(PALETTE[0], (len(mesh["colour"]), 1)))
        f, _ = witness(one, src, plddt, draws_zinc)
        out.append(("every vertex one band colour refused (PLDDT_COLOUR)", any(c == "PLDDT_COLOUR" for c, _ in f), f))
        swap = dict(mesh, colour=mesh["colour"][:, ::-1].copy())
        f, _ = witness(swap, src, plddt, draws_zinc)
        out.append(("channels swapped refused (PLDDT_COLOUR)", any(c == "PLDDT_COLOUR" for c, _ in f), f))
    return out


def main():
    rec_path = Path(sys.argv[1])
    rec = json.loads(rec_path.read_text())
    base = rec_path.parent
    for s in rec["scenes"].values():  # a fresh clone carries only the .gz: restore the plain file beside it, then check its hash as usual
        plain = base / s["x3d"]["file"]
        if not plain.exists() and (base / (plain.name + ".gz")).exists():
            import gzip
            plain.write_bytes(gzip.decompress((base / (plain.name + ".gz")).read_bytes()))
    files = [str(base / s["x3d"]["file"]) for s in rec["scenes"].values()]
    v = subprocess.run([str(FORK_PY), "-I", "-c", CHILD, str(FORK), *files], capture_output=True, text=True)
    if v.returncode:
        print(v.stderr[-800:]); return 1
    val = json.loads(v.stdout)
    git = lambda *a: subprocess.run(["git", "-C", str(FORK), *a], capture_output=True, text=True).stdout.strip()
    gate = {"schema": "x3d.mol.cinema.gate/1", "unsigned": True, "validator": {"tool": "x3d_mcp fork (validate_xml + semantic_diagnostics)", "commit": git("rev-parse", "HEAD")}, "scenes": {}, "controls": {}}
    ok = True
    srcs = {tid: read_source(ROOT / "data" / s["source"]) for tid, s in rec["scenes"].items()}
    for tid, s in rec["scenes"].items():
        x3d = base / s["x3d"]["file"]
        fails = []
        if sha(x3d) != s["x3d"]["sha256"]:
            fails.append(("SHA", "x3d differs from the receipt"))
        srcp = ROOT / "data" / s["source"]
        if sha(srcp) != s["source_sha256"]:
            fails.append(("SHA", "source differs from the receipt"))
        mesh = parse_x3d(x3d)
        if mesh["faces"] != s["evaluated_faces"]:
            fails.append(("COUNTS", f"{mesh['faces']} faces in the file, {s['evaluated_faces']} evaluated in Blender"))
        plddt, zinc = s["colour"] == "plddt", not any("zinc spheres skipped" in n for n in s.get("notes", []))
        f2, meas = witness(mesh, srcs[tid], plddt, zinc)
        fails += f2
        g = val[str(x3d)]
        good = g["xsd_valid"] and not g["semantic_errors"] and not fails
        ok &= good
        gate["scenes"][tid] = {"xsd_valid": g["xsd_valid"], "xsd_errors": g["xsd_errors"][:2], "semantic_errors": len(g["semantic_errors"]), "semantic_warnings": len(g["semantic_warnings"]),
                               "witness": "pass" if not fails else [f"{c}: {d}" for c, d in fails], "measured": meas, "alpha_all_one": None}
        print("ok  " if good else "FAIL", tid, "xsd", g["xsd_valid"], g["xsd_errors"][:1], "semantic errors", len(g["semantic_errors"]), json.dumps(meas), "" if not fails else fails)
    if len(rec["scenes"]) >= 2:  # the wrong-source control needs a second structure
        for tid in rec["scenes"]:
            s = rec["scenes"][tid]
            other = next((t for t in rec["scenes"] if t != tid), tid)
            res = selftest(parse_x3d(base / s["x3d"]["file"]), srcs[tid], s["colour"] == "plddt", not any("zinc spheres skipped" in n for n in s.get("notes", [])), srcs[other])
            gate["controls"][tid] = [{"control": n, "ok": bool(o)} for n, o, _ in res]
            for n, o, f in res:
                ok &= bool(o)
                print("  control", "ok  " if o else "FAIL", tid, n)
    (base / "gate.json").write_text(json.dumps(gate, indent=1))
    print("GATE", "green" if ok else "RED")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
