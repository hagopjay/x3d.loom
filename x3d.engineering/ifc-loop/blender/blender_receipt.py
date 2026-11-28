#!/usr/bin/env python3
"""Blender leg receipt: IFC A -> ifc2x3d -> X3D -> x3d-blender-io import -> Blender 5.3 -> x3d-blender-io export
-> normalize_blender -> x3d2ifc -> IFC B, compared with A by loop_receipt.compare.

  python3 blender_receipt.py A.ifc --name NAME --bpy PATH/python --repo PATH/x3d-blender-io [--label after]

Runs in the ifcopenshell venv and calls the bpy wheel's python for the Blender step. Blender keeps float32, so
geometry is judged at a stated tolerance (1e-5 relative, 0.01 file unit) instead of the X3D-only loop's 1e-9.
Triangulated meshes come back with Blender's vertex order, so they are judged by triangle count and by the world
quantities of the whole element, not by index.
"""
from __future__ import annotations
import hashlib, json, subprocess, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent)); sys.path.insert(0, str(HERE))
import ifcopenshell  # noqa: E402
import ifc2x3d, x3d2ifc, loop_receipt, normalize_blender  # noqa: E402

GEOM_REL, GEOM_ABS = 1e-5, 0.01


def arg(k, d=None):
    return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d


def git_head(repo):
    p = subprocess.run(["git", "-C", repo, "rev-parse", "--short", "HEAD"], capture_output=True, text=True)
    d = subprocess.run(["git", "-C", repo, "status", "--porcelain", "source"], capture_output=True, text=True)
    return p.stdout.strip() + ("+dirty" if d.stdout.strip() else "")


def tri_counts(f):
    return {p.GlobalId: sum(len(it.CoordIndex) for r in p.Representation.Representations for it in r.Items
                            if it.is_a("IfcTriangulatedFaceSet"))
            for p in f.by_type("IfcProduct") if p.Representation
            and any(it.is_a("IfcTriangulatedFaceSet") for r in p.Representation.Representations for it in r.Items)}


def main():
    a = Path(sys.argv[1]).resolve()
    name, bpy, repo, label = arg("--name", a.stem), arg("--bpy"), arg("--repo"), arg("--label", "run")
    out = HERE.parent / "results"
    A = ifcopenshell.open(str(a))
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        x = td / "loop.x3d"; bx = td / "blender.x3d"; bj = td / "blender.json"; nx = td / "norm.x3d"; b = td / "B.ifc"
        ifc2x3d.convert(a, x)
        p = subprocess.run([bpy, str(HERE / "blender_leg.py"), "--repo", repo, str(x), str(bx), str(bj)],
                           capture_output=True, text=True)
        if p.returncode:
            raise SystemExit(p.stderr[-2000:])
        held = json.loads(bj.read_text())
        import xml.etree.ElementTree as ET, collections
        hosts = collections.Counter(normalize_blender.ifc_class(e) for e in ET.parse(bx).getroot().iter()
                                    if normalize_blender.ifc_class(e))
        held["export_ifc_hosts"] = {"spatial and containment": sum(v for k, v in hosts.items() if k in normalize_blender.SPATIAL),
                                    "products": sum(v for k, v in hosts.items() if k not in normalize_blender.SPATIAL)}
        try:
            norm = normalize_blender.normalize(bx, nx)
            x3d2ifc.convert(nx, b, td / "w.json")
        except SystemExit as exc:
            norm = {"refused": str(exc)}
        B = ifcopenshell.open(str(b)) if b.exists() else None
        if B is not None:
            rows, q = loop_receipt.compare(A, B)
            w = json.loads((td / "w.json").read_text())
            ta, tb = tri_counts(A), tri_counts(B)
            ok = sum(1 for g in ta if tb.get(g) == ta[g])
            rows.pop("IfcTriangulatedFaceSet (same indices, coords within 1e-6 unit)")
            rows["IfcTriangulatedFaceSet (same triangle count; Blender reorders vertices)"] = {
                "carried": ok, "of": len(ta), "pass": ok == len(ta)}
            geo_ok = q["worst_relative_volume"] <= GEOM_REL and q["worst_relative_area"] <= GEOM_REL and q["worst_bbox_metres"] <= GEOM_ABS * A_scale(A)
            rows[f"world quantities within {GEOM_REL} relative, bbox within {GEOM_ABS} file unit"] = {
                "carried": q["bodies_measured"] if geo_ok else 0, "of": q["bodies_measured"], "pass": geo_ok}
            worst_pos = max((v["x3d_extrusion"] for r in w["rows"] for k, v in r.items() if k == "Position"), default=0.0)
            witness = {"extrusions": w["extrusions"], "worst_position_file_unit": worst_pos,
                       "dims_agree": all(v["agree"] for r in w["rows"] for k, v in r.items() if k != "Position"),
                       "position_within_tolerance": worst_pos <= GEOM_ABS}
        else:
            rows, q, witness = {}, {}, {}
    receipt = {"schema": "x3d.loom/ifc-loop-blender-receipt/1", "label": label, "source": a.name,
               "source_sha256": hashlib.sha256(a.read_bytes()).hexdigest(),
               "tools": {"ifcopenshell": ifcopenshell.version, "blender": held["blender"],
                         "x3d_blender_io": git_head(repo), "addon_bl_info_version": held.get("addon")},
               "blender_holds": {k: held[k] for k in ("objects", "by_type", "objects_with_ifc_guid", "parented", "export_ifc_hosts")},
               "normalize": norm, "rows": rows, "quantities": q, "extrusion_witness": witness,
               "all_rows_pass": bool(rows) and all(r["pass"] for r in rows.values())}
    (out / f"{name}-blender-{label}-receipt.json").write_text(json.dumps(receipt, indent=1))
    print(json.dumps(receipt["blender_holds"]), json.dumps(norm))
    for k, r in rows.items():
        print(f'{r["carried"]:>5} / {r["of"]:<5} {"PASS" if r["pass"] else "FAIL"}  {k}')
    print("witness", witness)


def A_scale(A):
    import ifcopenshell.util.unit as uu
    return uu.calculate_unit_scale(A)


if __name__ == "__main__":
    main()
