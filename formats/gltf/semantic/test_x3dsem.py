"""Every semantic rule must be able to say no: mutate the glTF between the two halves of the round trip and watch the rule fail.
    python -I semantic/test_x3dsem.py      (needs x3d.demo checked out next to x3d.loom, or LOOM_SEM_SAMPLES=dir)"""
import copy
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import x3dsem  # noqa: E402

DEMOS = Path(os.environ.get("LOOM_SEM_SAMPLES", Path(__file__).resolve().parents[3].parent / "x3d.demo" / "docs" / "demos"))
TWIN = DEMOS / "blender-walking-twin/v1/assets/twin.x3d"
GIZA = DEMOS / "heritage-geo/v3/giza-provenance-twin.x3d"


def run(src, mutate=None):
    d = Path(tempfile.mkdtemp())
    gl, back = d / "a.gltf", d / "a.back.x3d"
    x3dsem.x3d_to_gltf(src, gl)
    g = json.loads(gl.read_text())
    if mutate:
        mutate(g)
        gl.write_text(json.dumps(g))
    x3dsem.gltf_to_x3d(gl, back)
    rs = x3dsem.rules(x3dsem.semantics(src), x3dsem.semantics(back), g)
    return {r["id"]: r["pass"] for r in rs}


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


@unittest.skipUnless(TWIN.exists() and GIZA.exists(), f"demo X3D files not found under {DEMOS}")
class Rules(unittest.TestCase):
    def test_clean_round_trips_pass(self):
        for f in (TWIN, GIZA):
            self.assertTrue(all(run(f).values()), f)

    def test_metadata_on_a_host_that_is_no_gltf_node_is_lost_and_reported(self):
        # review 20 Nov 2026: the spec said "any host". Material, WorldInfo and TimeSensor are not glTF nodes, so their
        # Metadata does not travel. What matters is that the witness says so: S1 and S2 fail, the rest hold.
        probe = Path(__file__).resolve().parent / "fixtures" / "metadata-host-probe.x3d"
        a = x3dsem.semantics(probe)
        d = Path(tempfile.mkdtemp())
        x3dsem.x3d_to_gltf(probe, d / "a.gltf"); x3dsem.gltf_to_x3d(d / "a.gltf", d / "a.back.x3d")
        rs = {r["id"]: r for r in x3dsem.rules(a, x3dsem.semantics(d / "a.back.x3d"), json.loads((d / "a.gltf").read_text()))}
        self.assertEqual({k: v["pass"] for k, v in rs.items()}, {"S0": True, "S1": False, "S2": False, "S3": True, "S4": True, "S5": True, "S6": True})
        self.assertEqual((rs["S1"]["expected"], rs["S1"]["got"], rs["S2"]["expected"], rs["S2"]["got"]), (5, 2, 6, 3))

    def test_twin_has_24_ifc_ids(self):
        ifc = [n for n in find(json.loads(json.dumps(x3dsem.semantics(TWIN)["hosts"])), lambda n: n.get("name") == "GlobalId")]
        self.assertEqual(len(ifc), 24)

    def test_dropped_globalid_fails_S1_S2_S3(self):
        def m(g):
            ifc = next(find(packets(g), lambda n: n.get("x3d:name") == "IFC"))
            ifc["x3d:value"]["@list"] = [c for c in ifc["x3d:value"]["@list"] if c.get("x3d:name") != "GlobalId"]
            ifc.pop("loom:ifcGlobalId", None)
        r = run(TWIN, m)
        self.assertFalse(r["S1"]); self.assertFalse(r["S2"]); self.assertFalse(r["S3"])

    def test_changed_number_fails_S1_only(self):
        def m(g):
            d = next(find(packets(g), lambda n: n.get("@type") == "x3d:MetadataDouble"))
            d["x3d:value"]["@list"][0] += 1.0
        r = run(TWIN, m)
        self.assertFalse(r["S1"]); self.assertTrue(r["S2"]); self.assertTrue(r["S3"])

    def test_ifc_element_losing_its_body_fails_S3(self):
        def m(g):
            n = next(n for n in g["nodes"] if "KHR_xmp_json_ld" in n.get("extensions", {}) and "mesh" in n)
            del n["mesh"]
        self.assertFalse(run(TWIN, m)["S3"])

    def test_detached_packet_fails_S1(self):
        def m(g):
            n = next(n for n in g["nodes"] if "KHR_xmp_json_ld" in n.get("extensions", {}))
            del n["extensions"]
        self.assertFalse(run(GIZA, m)["S1"])

    def test_lost_crm_reference_fails_S4(self):
        def m(g):
            n = next(find(packets(g), lambda n: "cidoc-crm" in n.get("x3d:reference", "")))
            del n["x3d:reference"]
        self.assertFalse(run(GIZA, m)["S4"])

    def test_bad_packet_index_fails_S0(self):
        def m(g):
            n = next(n for n in g["nodes"] if "KHR_xmp_json_ld" in n.get("extensions", {}))
            n["extensions"]["KHR_xmp_json_ld"]["packet"] = 999
        # the back-converter would crash on an out-of-range index; S0 must catch it before conversion
        d = Path(tempfile.mkdtemp()); gl = d / "a.gltf"
        x3dsem.x3d_to_gltf(GIZA, gl); g = json.loads(gl.read_text()); m(g)
        s0 = next(r for r in x3dsem.rules(x3dsem.semantics(GIZA), x3dsem.semantics(GIZA), g) if r["id"] == "S0")
        self.assertFalse(s0["pass"])

    def test_head_meta_and_prov(self):
        def m(g):
            packets(g)[0]["x3d:head"]["meta"].pop()
            del packets(g)[0]["prov:wasDerivedFrom"]["@id"]
        r = run(GIZA, m)
        self.assertFalse(r["S5"]); self.assertFalse(r["S6"])


class Fields(unittest.TestCase):
    def test_mfstring(self):
        self.assertEqual(x3dsem.parse_mfstring('"a b" "c\\"d"'), ["a b", 'c"d'])
        self.assertEqual(x3dsem.parse_mfstring(x3dsem.fmt_mfstring(['x"y\\z', ""])), ['x"y\\z', ""])

    def test_center_folds_into_translation(self):
        import xml.etree.ElementTree as ET
        t = x3dsem.transform_of(ET.fromstring('<Transform center="1 0 0" rotation="0 0 1 3.141592653589793"/>'))
        self.assertAlmostEqual(t["translation"][0], 2.0, places=9)


if __name__ == "__main__":
    unittest.main()
