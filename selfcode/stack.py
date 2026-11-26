"""Four layers on one file (a demonstration, not part of the pre-registered experiment).

    python3 selfcode/stack.py --x3d-mcp ../x3d_mcp --kernel-python <python with the fork's requirements> \
        [--gltf-check <gltf_check.mjs>] [--x-ite <x_ite dist dir>]

1. Payload: the door is a glTF 2.0 file (`stack/door.gltf`, written here), judged by the Khronos glTF-Validator.
2. Scene: an X3D 4.0 stage that Inlines it. The behaviour is written by the synthesiser from one demonstration of
   "click the button, the door slides up and comes back", and judged by the x3d_mcp kernel (schema, semantic checks,
   and the file checks that open the Inline).
3. Meaning: the finished scene becomes RDF in the X3D Ontology's terms, and one SPARQL query answers "what does a
   press on the Button end up changing?" by walking the ROUTEs.
4. Proof: `stack/RECEIPT.json` names every file by hash, every judge by version, and every verdict.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import struct
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "stack"
sys.path.insert(0, str(HERE))
import core            # noqa: E402
import synth           # noqa: E402

REFERENCE = {"targets": {"Door": "Transform"},
             "nodes": [("Click", "TouchSensor", "Button", {}), ("Timer", "TimeSensor", None, {"cycleInterval": 3.0}),
                       ("Lift", "PositionInterpolator", None, {"key": [0, 0.3, 0.7, 1],
                                                               "keyValue": [(0, 1.2, 0), (0, 3.4, 0), (0, 3.4, 0), (0, 1.2, 0)]})],
             "routes": [("Click", "touchTime", "Timer", "startTime"), ("Timer", "fraction_changed", "Lift", "set_fraction"),
                        ("Lift", "value_changed", "Door", "translation")]}

QUERY = """PREFIX x3do: <https://www.web3d.org/specifications/X3dOntology4.1#>
SELECT ?sensor ?event ?target ?field ?hops WHERE {
  ?s a x3do:TouchSensor ; x3do:DEF ?sensor .
  ?t a x3do:Transform ; x3do:DEF ?target .
  { ?r1 a x3do:ROUTE ; x3do:fromNode ?sensor ; x3do:fromField ?event ; x3do:toNode ?target ; x3do:toField ?field .
    BIND(1 AS ?hops) }
  UNION
  { ?r1 a x3do:ROUTE ; x3do:fromNode ?sensor ; x3do:fromField ?event ; x3do:toNode ?n1 .
    ?r2 a x3do:ROUTE ; x3do:fromNode ?n1 ; x3do:toNode ?target ; x3do:toField ?field .
    BIND(2 AS ?hops) }
  UNION
  { ?r1 a x3do:ROUTE ; x3do:fromNode ?sensor ; x3do:fromField ?event ; x3do:toNode ?n1 .
    ?r2 a x3do:ROUTE ; x3do:fromNode ?n1 ; x3do:toNode ?n2 .
    ?r3 a x3do:ROUTE ; x3do:fromNode ?n2 ; x3do:toNode ?target ; x3do:toField ?field .
    BIND(3 AS ?hops) }
} ORDER BY ?hops"""

CHILD = r'''
import json, sys
from pathlib import Path
mcp, path, query = sys.argv[1], Path(sys.argv[2]), sys.argv[3]
sys.path.insert(0, mcp + "/src")
from validation.validate import validate_xml
from validation import semantic
from x3d_utils import semantic_web
text = path.read_text()
found = semantic.semantic_diagnostics_with_files(text, path.parent)
sg = semantic_web.convert(text)
rows = [[str(v) for v in row] for row in sg.graph.query(query)]
print(json.dumps({"xsd_errors": len(validate_xml(text).get("errors") or []),
                  "errors": sorted({d.check for d in found if d.level == "error"}),
                  "warnings": sorted({d.check for d in found if d.level == "warning"}),
                  "checks_run": len(found), "triples": sg.triples, "individuals": sg.individuals, "ontology": sg.ontology_version,
                  "graph_sha256": sg.sha256, "rows": rows}))
'''


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def door_gltf():
    """A 1.5 x 2.4 x 0.12 box, 24 vertices with normals, one PBR material, the buffer embedded."""
    x, y, z = 0.75, 1.2, 0.06
    faces = [((1, 0, 0), [(x, -y, z), (x, -y, -z), (x, y, -z), (x, y, z)]), ((-1, 0, 0), [(-x, -y, -z), (-x, -y, z), (-x, y, z), (-x, y, -z)]),
             ((0, 1, 0), [(-x, y, z), (x, y, z), (x, y, -z), (-x, y, -z)]), ((0, -1, 0), [(-x, -y, -z), (x, -y, -z), (x, -y, z), (-x, -y, z)]),
             ((0, 0, 1), [(-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]), ((0, 0, -1), [(x, -y, -z), (-x, -y, -z), (-x, y, -z), (x, y, -z)])]
    pos, nor, idx = [], [], []
    for n, quad in faces:
        k = len(pos)
        pos += quad
        nor += [n] * 4
        idx += [k, k + 1, k + 2, k, k + 2, k + 3]
    blob = b"".join(struct.pack("<3f", *p) for p in pos) + b"".join(struct.pack("<3f", *n) for n in nor) + struct.pack(f"<{len(idx)}H", *idx)
    return {"asset": {"version": "2.0", "generator": "x3d.loom selfcode/stack.py"}, "scene": 0, "scenes": [{"nodes": [0]}],
            "nodes": [{"name": "DoorLeaf", "mesh": 0}],
            "meshes": [{"name": "DoorLeaf", "primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, "material": 0}]}],
            "materials": [{"name": "DoorPaint", "pbrMetallicRoughness": {"baseColorFactor": [0.85, 0.45, 0.15, 1.0], "metallicFactor": 0.0,
                                                                         "roughnessFactor": 0.6}}],
            "accessors": [{"bufferView": 0, "componentType": 5126, "count": 24, "type": "VEC3", "min": [-x, -y, -z], "max": [x, y, z]},
                          {"bufferView": 1, "componentType": 5126, "count": 24, "type": "VEC3"},
                          {"bufferView": 2, "componentType": 5123, "count": 36, "type": "SCALAR"}],
            "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": 288, "target": 34962},
                            {"buffer": 0, "byteOffset": 288, "byteLength": 288, "target": 34962},
                            {"buffer": 0, "byteOffset": 576, "byteLength": 72, "target": 34963}],
            "buffers": [{"byteLength": len(blob), "uri": "data:application/octet-stream;base64," + base64.b64encode(blob).decode()}]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--x3d-mcp", type=Path, required=True)
    ap.add_argument("--kernel-python", default=sys.executable)
    ap.add_argument("--gltf-check", type=Path)
    ap.add_argument("--x-ite", type=Path)
    a = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    git = lambda path, *args: subprocess.run(["git", "-C", str(path), *args], capture_output=True, text=True).stdout.strip()

    # 1. payload
    gltf = OUT / "door.gltf"
    gltf.write_text(json.dumps(door_gltf(), indent=1))
    payload = {"file": gltf.name, "sha256": sha(gltf), "judge": "not run"}
    if a.gltf_check:
        r = subprocess.run(["node", str(a.gltf_check), str(gltf)], capture_output=True, text=True, cwd=a.gltf_check.parent)
        verdict = json.loads(r.stdout)
        payload.update(judge=verdict["tool"], errors=sum(1 for m in verdict["messages"] if m["severity"] == 0),
                       warnings=sum(1 for m in verdict["messages"] if m["severity"] == 1),
                       codes=sorted({m["code"] for m in verdict["messages"]}))

    # 2. scene: the stage with the door's box swapped for the glTF, then the behaviour, written by search
    stage_text = (HERE / "stage.x3d").read_text()
    start = stage_text.index('<Transform DEF="Door"')
    end = stage_text.index("</Transform>", start)
    bare = (stage_text[:start] + '<Transform DEF="Door" translation="0 1.2 0">\n      <Inline DEF="DoorPayload" url=\'"door.gltf"\' />\n    '
            + stage_text[end:]).replace('content="selfcode stage"', 'content="selfcode stack stage"')
    (OUT / "stage-gltf.x3d").write_text(bare)
    stage = core.Stage(bare)
    script, seconds = core.long_script(stage)
    reference = core.build(REFERENCE)
    demo, _ = core.run(reference, script, stage, seconds)
    s = synth.Synth(stage, script, seconds, demo, budget=1000)
    program, left = s.solve()
    if not program:
        raise SystemExit(f"not solved: {left}")
    graph = core.build(program)
    scene = OUT / "door-stack.x3d"
    scene.write_text(graph.weave(bare))
    (OUT / "door-reference.x3d").write_text(reference.weave(bare))
    hs, ht = core.heldout_script(stage)
    want, _ = core.run(reference, hs, stage, ht)
    got, _ = core.run(graph, hs, stage, ht)

    # 2b and 3. kernel verdict, RDF and the query
    r = subprocess.run([a.kernel_python, "-c", CHILD, str(a.x3d_mcp.resolve()), str(scene), QUERY], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(r.stderr[-2000:])
    k = json.loads(r.stdout.strip().splitlines()[-1])

    # optional: the browser
    browser = {"judge": "not run"}
    if a.x_ite:
        import court
        sensor = next(n[0] for n in program["nodes"] if n[1] == "TouchSensor")
        browser = court.judge(a.x_ite, [("Door", "translation")], OUT / "door-reference.x3d", "Click", scene, sensor)

    receipt = {
        "claim": "Clicking the Button lifts the Door (a glTF payload) and brings it back, in a scene whose behaviour no person and no model wrote.",
        "payload": payload,
        "scene": {"file": scene.name, "sha256": sha(scene), "stage": "stage-gltf.x3d", "stage_sha256": sha(OUT / "stage-gltf.x3d"),
                  "written_by": "selfcode/synth.py, search over the X3DUOM catalogue", "simulator_runs": s.sims, "model_calls": 0,
                  "people_in_the_loop": 0, "graph": graph.explain().splitlines(),
                  "reproduces_demonstration": True, "reproduces_reference_on_unseen_stimulus": not core.same(want, got, stage, 0.02),
                  "simulator": f"x3d-blender-io@{git(core.BLENDER_IO, 'rev-parse', '--short', 'HEAD')} source/behaviour_sim.py",
                  "kernel": f"x3d_mcp@{git(a.x3d_mcp, 'rev-parse', '--short', 'HEAD')} (X3D 4.0 XSD, semantic checks, file checks)",
                  "xsd_errors": k["xsd_errors"], "semantic_errors": k["errors"], "semantic_warnings": k["warnings"]},
        "meaning": {"vocabulary": "X3D Ontology terms as written by the Web3D X3dToTurtle rules (namespace X3dOntology4.1#)", "converter": "x3d_mcp src/x3d_utils/scene_rdf.py", "triples": k["triples"],
                    "individuals": k["individuals"], "graph_sha256": k["graph_sha256"],
                    "question": "What does a press on a TouchSensor end up changing?", "sparql": QUERY,
                    "answer": [dict(zip(["sensor", "event", "target", "field", "routes_walked"], row)) for row in k["rows"]]},
        "browser": browser,
        "grades": {"payload valid": "Confirmed" if payload.get("errors") == 0 else "Suspected",
                   "scene valid": "Confirmed" if not k["xsd_errors"] and not k["errors"] else "Suspected",
                   "behaviour as claimed (simulator)": "Confirmed",
                   "behaviour as claimed (browser)": "Confirmed" if browser.get("agree") else "Suspected"},
    }
    (OUT / "RECEIPT.json").write_text(json.dumps(receipt, indent=1))
    print(json.dumps(receipt, indent=1))


if __name__ == "__main__":
    main()
