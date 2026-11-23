"""Send every compiled style world through the Loom glTF semantic bridge and back.
X3D (MetadataSet xst:Style + xst:role tags) -> glTF 2.0 KHR_xmp_json_ld packets -> X3D, judged by rules S0..S6.
Usage: python3 tools/gltf_roundtrip.py [out/gltf-receipt.json]   (run from x3d.style/ after bin/build.mjs)
"""
import glob, json, os, subprocess, sys, tempfile
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
BR = os.path.join(ROOT, "..", "formats", "gltf", "semantic", "x3dsem.py")
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "out", "gltf-receipt.json")
rows = []
for x in sorted(glob.glob(os.path.join(ROOT, "out", "*.x3d"))):
    with tempfile.TemporaryDirectory() as d:
        subprocess.run([sys.executable, "-I", BR, "roundtrip", x, d], capture_output=True, text=True)
        s = json.load(open(os.path.join(d, "semantic.json")))
        stem = os.path.splitext(os.path.basename(x))[0]
        g = json.load(open(os.path.join(d, stem + ".gltf")))
        rows.append({"world": os.path.basename(x), "verdict": s["verdict"], "hosts": s["hosts"], "metadata_nodes": s["metadata_nodes"],
                     "packets": len(g["extensions"]["KHR_xmp_json_ld"]["packets"]), "rules": {r["id"]: r["pass"] for r in s["rules"]}, "converter": s["converter"]})
        print(rows[-1]["world"].ljust(20), s["verdict"], "hosts", s["hosts"], "metadata nodes", s["metadata_nodes"], "packets", rows[-1]["packets"])
rec = {"instrument": f"x3d.loom formats/gltf/semantic/x3dsem.py ({rows[0]['converter']}), rules S0..S6", "worlds": len(rows), "pass": sum(r["verdict"] == "pass" for r in rows),
       "metadata_nodes": sum(r["metadata_nodes"] for r in rows), "note": "meaning layer only: the style and role metadata. Geometry is carried approximately and was not rendered from glTF.", "rows": rows}
json.dump(rec, open(out, "w"), indent=1)
print("pass", rec["pass"], "/", rec["worlds"])
