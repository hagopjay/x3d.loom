#!/usr/bin/env python3
"""USD leg of the IFC loop, with OpenUSD's own validators and Blender's USD export as the baseline.

  python3 usd_loop_receipt.py NAME A.ifc LOOP.x3d [--blender-usd BLENDER.usdc]

  A.ifc -> (ifc-loop) X3D -> x3dusd to-usd -> .usda -> x3dusd to-x3d -> X3D' -> x3d2ifc -> B.ifc, compared with A
Writes results/NAME-usd-loop-receipt.json beside this file. USD keeps mesh points as point3f (float32), so
triangulated meshes are judged at 0.001 file unit (IFC millimetres here) instead of the X3D loop's 1e-6.
"""
from __future__ import annotations
import collections, hashlib, json, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOOP = HERE.parent.parent / "x3d.engineering" / "ifc-loop"
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(LOOP))
from pxr import Sdf, Usd, UsdValidation  # noqa: E402
import ifcopenshell  # noqa: E402
import numpy as np  # noqa: E402
import x3dusd, x3d2ifc, loop_receipt  # noqa: E402

TESS_TOL = 1e-3


def validate(stage):
    reg = UsdValidation.ValidationRegistry()
    vals = reg.GetOrLoadAllValidators()
    errs = UsdValidation.ValidationContext(vals).Validate(stage)
    return {"validators": len(vals), "errors": len(errs),
            "by_name": dict(collections.Counter(e.GetName() for e in errs))}


def tess_rows(A, B):
    ok = n = 0
    worst = 0.0
    for p in A.by_type("IfcProduct"):
        if not p.Representation:
            continue
        for r in p.Representation.Representations:
            for it in r.Items:
                if not it.is_a("IfcTriangulatedFaceSet"):
                    continue
                n += 1
                q = B.by_guid(p.GlobalId)
                o = next((i for rr in q.Representation.Representations for i in rr.Items), None) if q and q.Representation else None
                if o is None or not o.is_a("IfcTriangulatedFaceSet") or list(map(list, o.CoordIndex)) != list(map(list, it.CoordIndex)):
                    continue
                d = float(np.abs(np.array(o.Coordinates.CoordList) - np.array(it.Coordinates.CoordList)).max())
                worst = max(worst, d)
                ok += d <= TESS_TOL
    return ok, n, worst


def blender_baseline(path, A):
    """What Blender 5.3's own USD export (export_custom_properties=True) kept of the IFC semantics."""
    st = Usd.Stage.Open(str(path))
    texts = []
    for p in st.Traverse():
        for a in p.GetAttributes():
            if a.GetName().startswith("userProperties"):
                texts.append(str(a.Get()))
    blob = "\n".join(texts)
    guids = [e.GlobalId for e in A.by_type("IfcRoot") if e.is_a("IfcObjectDefinition")]
    as_def = sum(1 for g in guids if ("g" + g.replace("$", "__")) in blob)
    values = [(ps.Name, pr.Name, str(pr.NominalValue.wrappedValue)) for ps in A.by_type("IfcPropertySet") for pr in ps.HasProperties]
    keys_in = sum(1 for _, k, _ in values if k in blob)
    classes = sum(1 for e in A.by_type("IfcProduct") if f'"{e.is_a()}"' in blob or e.is_a() in blob)
    return {"prims": sum(1 for _ in st.Traverse()), "userProperties_attributes": len(texts),
            "GlobalIds_recoverable_only_from_DEF_names": as_def, "GlobalIds": len(guids),
            "property_keys_present": keys_in, "property_values": len(values),
            "ifc_class_names_present": classes, "products": len(A.by_type("IfcProduct")),
            "note": "x3d-blender-io keeps Metadata as nested dict custom properties; Blender's USD exporter writes only simple ones"}


def main():
    name, a, loop_x3d = sys.argv[1], Path(sys.argv[2]).resolve(), Path(sys.argv[3]).resolve()
    A = ifcopenshell.open(str(a))
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        usda, back, b, w = td / f"{name}.usda", td / "back.x3d", td / "B.ifc", td / "w.json"
        counts = x3dusd.to_usd(loop_x3d, usda)
        val = validate(Usd.Stage.Open(str(usda)))
        # control: a copy with no stage metadata must make the validators speak
        lyr = Sdf.Layer.FindOrOpen(str(usda))
        ctrl = td / "control.usda"
        cl = Sdf.Layer.CreateNew(str(ctrl)); cl.TransferContent(lyr)
        cl.ClearDefaultPrim(); cl.pseudoRoot.ClearInfo("metersPerUnit"); cl.pseudoRoot.ClearInfo("upAxis"); cl.Save()
        ctrl_val = validate(Usd.Stage.Open(str(ctrl)))
        x3dusd.to_x3d(usda, back)
        x3d2ifc.convert(back, b, w)
        B = ifcopenshell.open(str(b))
        rows, q = loop_receipt.compare(A, B)
        rows.pop("IfcTriangulatedFaceSet (same indices, coords within 1e-6 unit)")
        ok, n, worst = tess_rows(A, B)
        rows[f"IfcTriangulatedFaceSet (same indices, coords within {TESS_TOL} file unit: USD point3f is float32)"] = {
            "carried": ok, "of": n, "pass": ok == n, "worst": worst}
        wit = json.loads(w.read_text())
        usda_bytes = usda.read_bytes()
    receipt = {"schema": "x3d.loom/usd-loop-receipt/1", "source": a.name, "source_sha256": hashlib.sha256(a.read_bytes()).hexdigest(),
               "loop_x3d_sha256": hashlib.sha256(loop_x3d.read_bytes()).hexdigest(), "usda_bytes": len(usda_bytes),
               "tools": {"usd-core": ".".join(map(str, Usd.GetVersion())), "ifcopenshell": ifcopenshell.version},
               "usd_counts": counts, "usd_validation": val,
               "usd_validation_control (no metersPerUnit, upAxis, defaultPrim)": ctrl_val,
               "rows": rows, "quantities": q, "extrusion_witness": {"extrusions": wit["extrusions"], "all_agree": wit["all_agree"]},
               "all_rows_pass": all(r["pass"] for r in rows.values())}
    if "--blender-usd" in sys.argv:
        receipt["baseline_blender_usd_export"] = blender_baseline(Path(sys.argv[sys.argv.index("--blender-usd") + 1]), A)
    out = HERE / "results"; out.mkdir(exist_ok=True)
    (out / f"{name}-usd-loop-receipt.json").write_text(json.dumps(receipt, indent=1))
    for k, r in rows.items():
        print(f'{r["carried"]:>5} / {r["of"]:<5} {"PASS" if r["pass"] else "FAIL"}  {k}')
    print("usd validation", val, "control", ctrl_val)
    print("baseline", receipt.get("baseline_blender_usd_export"))


if __name__ == "__main__":
    main()
