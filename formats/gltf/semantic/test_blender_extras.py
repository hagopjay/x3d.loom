"""Every lift rule must be able to say no: break the lifted glTF (or the extras) and watch the rule fail.
    python -I semantic/test_blender_extras.py
Fixtures: fixtures/blender-twin.glb is the Fault Lab clean twin after X3D -> Blender 5.3.0 (x3d-blender-io 2.6.5) -> Blender's
glTF exporter with custom properties on; fixtures/blender-twin.source.x3d is the X3D it came from."""
import copy
import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import blender_extras as bx  # noqa: E402
import x3dsem  # noqa: E402

FX = Path(__file__).resolve().parent / "fixtures"
GLB, SRC = FX / "blender-twin.glb", FX / "blender-twin.source.x3d"
G, REST = bx.load(GLB)
SOURCE = x3dsem.semantics(SRC)


def verdicts(mutate_after=None, mutate_before=None):
    g = copy.deepcopy(G)
    if mutate_before:
        mutate_before(g)
    out, rep = bx.lift(g, "0" * 64, "t.glb")
    if mutate_after:
        mutate_after(out)
    return {r["id"]: r["pass"] for r in bx.rules(g, out, SOURCE)}, rep


def packets(g):
    return g["extensions"]["KHR_xmp_json_ld"]["packets"]


def find(node, pred):
    if isinstance(node, dict):
        if pred(node):
            yield node
        for v in node.values():
            yield from find(v, pred)
    elif isinstance(node, list):
        for v in node:
            yield from find(v, pred)


class Lift(unittest.TestCase):
    def test_clean_lift_passes_every_rule(self):
        v, rep = verdicts()
        self.assertTrue(all(v.values()), v)
        self.assertEqual((rep["trees_found"], rep["trees_lifted"], rep["metadata_nodes"], rep["errors"]), (3, 3, 6, []))
        self.assertEqual(sorted(x["collection"] for x in rep["lifted"]), ["materials", "nodes", "scenes"])

    def test_file_round_trip_keeps_the_binary_chunk(self):
        d = Path(tempfile.mkdtemp())
        r = bx.run(GLB, d / "o.glb", SRC)
        self.assertEqual(r["verdict"], "pass")
        self.assertTrue(r["output"]["bin_chunk_unchanged"])
        self.assertEqual(r["input"]["sha256"], hashlib.sha256(GLB.read_bytes()).hexdigest())
        g2, rest2 = bx.load(d / "o.glb")
        self.assertEqual(rest2, REST)
        self.assertEqual(len(bx.hosts_in(g2)), 3)

    def test_gltf_json_container(self):
        d = Path(tempfile.mkdtemp())
        import json
        (d / "a.gltf").write_text(json.dumps({k: v for k, v in G.items() if k in ("asset", "scenes", "nodes", "materials")}))
        r = bx.run(d / "a.gltf", d / "b.gltf", SRC)
        self.assertEqual(r["trees_lifted"], 3)

    def test_numbers_are_typed(self):
        out, _ = bx.lift(G, "0" * 64)
        d = next(find(packets(out), lambda n: n.get("x3d:name") == "depth_m"))
        self.assertEqual(d["x3d:value"]["@list"], [9.62])
        self.assertIsInstance(G["nodes"][6]["extras"]["x3d_transform_metadata"]["value"][1]["value"], str)

    def test_crm_class_is_a_json_ld_type(self):
        out, _ = bx.lift(G, "0" * 64)
        s = next(find(packets(out), lambda n: n.get("x3d:name") == "CidocCrm"))
        self.assertIn("crm:E25_Human-Made_Feature", s["@type"])

    def test_lost_extras_tree_fails_L1_L2(self):
        v, _ = verdicts(mutate_before=lambda g: g["materials"][3]["extras"].pop("x3d_metadata"))
        self.assertFalse(v["L1"]); self.assertFalse(v["L2"]); self.assertTrue(v["L5"])

    def test_changed_value_fails_L1_only(self):
        def m(g):
            next(find(packets(g), lambda n: n.get("x3d:name") == "depth_m"))["x3d:value"]["@list"][0] = 96.2
        v, _ = verdicts(m)
        self.assertFalse(v["L1"]); self.assertTrue(v["L2"]); self.assertTrue(v["L4"])

    def test_packet_on_the_wrong_host_fails_L1(self):
        def m(g):
            g["materials"][0]["extensions"] = g["materials"][3].pop("extensions")
            next(p for p in packets(g) if p.get("x3d:hostDEF") == "Mat_ChamberA")["x3d:hostDEF"] = "Mat_Other"
        self.assertFalse(verdicts(m)[0]["L1"])

    def test_invented_node_fails_L2(self):
        def m(g):
            s = next(find(packets(g), lambda n: n.get("x3d:name") == "CidocCrm"))
            s["x3d:value"]["@list"].append({"@type": "x3d:MetadataString", "x3d:name": "invented", "x3d:value": {"@list": ["x"]}})
        v, _ = verdicts(m)
        self.assertFalse(v["L1"]); self.assertFalse(v["L2"])

    def test_untyped_crm_fails_L3(self):
        def m(g):
            s = next(find(packets(g), lambda n: n.get("x3d:name") == "CidocCrm"))
            s["@type"] = "x3d:MetadataSet"
        v, _ = verdicts(m)
        self.assertFalse(v["L3"]); self.assertTrue(v["L1"])

    def test_number_left_as_text_fails_L4(self):
        def m(g):
            next(find(packets(g), lambda n: n.get("x3d:name") == "depth_m"))["x3d:value"]["@list"] = ["9.62"]
        self.assertFalse(verdicts(m)[0]["L4"])

    def test_touching_anything_else_fails_L5(self):
        def m(g):
            g["nodes"][0]["translation"][0] += 1
        self.assertFalse(verdicts(m)[0]["L5"])
        self.assertFalse(verdicts(lambda g: g["scenes"][0]["extras"].pop("x3d_scene_metadata"))[0]["L5"])

    def test_bad_reference_fails_L0_and_missing_prov_fails_L6(self):
        def m(g):
            g["nodes"][6]["extensions"]["KHR_xmp_json_ld"]["packet"] = 999
        self.assertFalse(verdicts(m)[0]["L0"])
        self.assertFalse(verdicts(lambda g: packets(g)[0].pop("prov:wasGeneratedBy"))[0]["L6"])

    def test_malformed_extras_are_reported_not_fatal(self):
        def m(g):
            g["nodes"][6]["extras"]["x3d_transform_metadata"] = {"node": "Transform", "value": "x"}
        g = copy.deepcopy(G); m(g)
        out, rep = bx.lift(g, "0" * 64)
        self.assertEqual((rep["trees_found"], rep["trees_lifted"], len(rep["errors"])), (3, 2, 1))

    def test_without_a_source_the_source_rules_are_not_run(self):
        out, _ = bx.lift(G, "0" * 64)
        rs = {r["id"]: r["pass"] for r in bx.rules(G, out, None)}
        self.assertEqual((rs["L1"], rs["L2"], rs["L3"]), (None, None, None))

    def test_two_trees_on_one_node_both_arrive(self):
        g = copy.deepcopy(G)
        g["nodes"][6]["extras"]["x3d_metadata"] = {"node": "MetadataInteger", "name": "n", "value": "1 2 3"}
        out, rep = bx.lift(g, "0" * 64)
        self.assertEqual(rep["trees_lifted"], 4)
        hs = bx.hosts_in(out)
        self.assertEqual(len(hs), 4)
        self.assertIn([1, 2, 3], [h["metadata"]["value"] for h in hs])

    def test_lift_does_not_modify_its_input(self):
        g = copy.deepcopy(G)
        bx.lift(g, "0" * 64)
        self.assertEqual(g, G)


if __name__ == "__main__":
    unittest.main()
