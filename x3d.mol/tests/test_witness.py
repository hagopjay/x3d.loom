#!/usr/bin/env python3 -I
"""Negative and positive controls for src/witness.py.

  /path/to/python -I tests/test_witness.py          # needs scenes/ built by src/build.py

Every control edits a copy of a real scene and must be rejected with its own stable code; the unedited scenes must pass.
A witness that passes everything proves nothing, so a control that is NOT rejected fails this test.
"""
from __future__ import annotations

import json
import re
import sys
import tempfile
from pathlib import Path

import numpy as np
from lxml import etree

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
import witness as WT  # noqa: E402

SCENES = ROOT / "scenes"


def fl(s: str) -> np.ndarray:
    return np.array(s.split(), dtype=np.float64)


def fmt(a) -> str:
    return " ".join(("%.3f" % x).rstrip("0").rstrip(".") if abs(x) > 1e-12 else "0" for x in np.asarray(a).ravel())


def meta(root, name):
    for m in root.iter("MetadataString", "MetadataFloat", "MetadataInteger"):
        if m.get("name") == name:
            return m
    raise KeyError(name)


def cartoons(root):
    return [s.find("IndexedTriangleSet") for s in root.iter("Shape") if (s.get("DEF") or "").startswith("Cartoon_")]


def c_trace(root):
    for its in cartoons(root):
        co = its.find("Coordinate"); co.set("point", fmt(fl(co.get("point")) + np.array([5.0, 0, 0] * (len(fl(co.get("point"))) // 3))))


def c_units(root):
    for its in cartoons(root):
        co = its.find("Coordinate"); co.set("point", fmt(fl(co.get("point")) * 0.1))


def c_plddt(root):
    m = meta(root, "plddt"); m.set("value", fmt(fl(m.get("value"))[::-1]).replace(".", ".", 1))


def c_color(root):
    col = cartoons(root)[0].find("Color"); a = fl(col.get("color")); a[:3] = (0.0, 0.0, 0.0); col.set("color", fmt(a))


def c_residues(root):
    m = meta(root, "residues"); v = m.get("value"); m.set("value", v[:v.rstrip().rfind(' "')])


def c_sha(root):
    m = meta(root, "source"); v = m.get("value"); m.set("value", v[:-2] + ("0" if v[-2] != "0" else "1") + '"')


def c_ca(root):
    m = meta(root, "ca"); a = fl(m.get("value")); a[3] += 0.01; m.set("value", fmt(a))


def c_ss(root):
    m = meta(root, "ss"); v = m.get("value"); m.set("value", v[:-2] + '"')


def site_json(root):
    m = meta(root, "sites"); v = m.get("value")
    return m, json.loads(re.findall(r'"((?:[^"\\]|\\.)*)"', v)[0].replace('\\"', '"'))


def c_zn(root):
    for t in root.iter("Transform"):
        if (t.get("DEF") or "").startswith("Zn_"):
            t.set("translation", fmt(fl(t.get("translation")) + 0.5)); return


def c_donors(root):
    m, sites = site_json(root); sites[0]["donors"][0]["d"] += 0.01
    m.set("value", '"' + json.dumps(sites, separators=(",", ":")).replace('"', '\\"') + '"')


def c_bond(root):
    for t in root.iter("Transform"):
        if (t.get("DEF") or "").startswith("Bond_"):
            cyl = t.find(".//Cylinder"); cyl.set("height", "%.4f" % (float(cyl.get("height")) + 0.05)); return


def c_glow(root):
    for t in root.iter("Transform"):
        if (t.get("DEF") or "").startswith("Bond_") and t.find(".//Cylinder").get("radius") == "0.075":
            t.find(".//Cylinder").set("radius", "0.04"); return


def c_label(root):
    for t in root.iter("Text"):
        t.set("string", '"9.99 Å"'); return


def c_cage(root):
    for s in list(root.iter("Shape")):
        if (s.get("DEF") or "").startswith("Cage_"):
            s.getparent().remove(s); return


def c_cage_move(root):
    for s in root.iter("Shape"):
        if (s.get("DEF") or "").startswith("Cage_"):
            co = s.find(".//Coordinate"); co.set("point", fmt(fl(co.get("point")) + 0.3)); return


def c_pae_t(root):
    m = meta(root, "pae_half_angstrom"); a = fl(m.get("value")); n = int(round(len(a) ** 0.5))
    m.set("value", " ".join(str(int(x)) for x in a.reshape(n, n).T.ravel()))


def c_pae_1(root):
    m = meta(root, "pae_half_angstrom"); a = fl(m.get("value")); a[7] = (a[7] + 5) % 64; m.set("value", " ".join(str(int(x)) for x in a))


def c_focus(root):
    m = meta(root, "focus"); m.set("value", m.get("value").replace("omitted", "kept"))


CONTROLS = [  # (name, scene, edit, code that must appear)
    ("cartoon moved 5 A", "1aay", c_trace, "TRACE"),
    ("cartoon scaled by 0.1 (nm read as A)", "1aay", c_units, "UNITS"),
    ("confidence list reversed", "AF-P26651-F1", c_plddt, "PLDDT"),
    ("first ring recoloured black", "AF-P26651-F1", c_color, "COLOR"),
    ("last residue dropped from the list", "1aay", c_residues, "RESIDUES"),
    ("source sha256 altered", "1aay", c_sha, "SOURCE_SHA"),
    ("one guide atom moved 0.01 A", "1aay", c_ca, "CA"),
    ("ss string one letter short", "1aay", c_ss, "SS_FORMAT"),
    ("zinc sphere moved 0.5 A", "1aay", c_zn, "SITE_ZN"),
    ("a donor distance edited by 0.01 A", "1aay", c_donors, "SITE_DONORS"),
    ("a bond made 0.05 A longer", "1aay", c_bond, "SITE_BOND"),
    ("a glowing bond drawn dim", "1aay", c_glow, "SITE_BOND"),
    ("a label changed to 9.99", "1aay", c_label, "SITE_LABEL"),
    ("cage removed", "1aay", c_cage, "SITE_CAGE"),
    ("cage moved 0.3 A", "1aay", c_cage_move, "SITE_CAGE"),
    ("PAE transposed", "AF-P26651-F1", c_pae_t, "PAE"),
    ("one PAE value changed", "AF-P26651-F1", c_pae_1, "PAE"),
    ("focus note says kept for omitted", "6fuw", c_focus, "FOCUS"),
]
POSITIVE = ["1aay", "1ubd", "2jvx", "6fuw", "AF-P26651-F1", "AF-P04637-F1"]


def main() -> int:
    rows, bad = [], 0
    tmp = Path(tempfile.mkdtemp(prefix="xmol-controls-"))
    for scene in POSITIVE:
        f = WT.check(SCENES / f"{scene}.x3d")
        ok = not f
        bad += not ok
        rows.append({"kind": "positive", "scene": scene, "expected": "pass", "got": "pass" if ok else [c for c, _ in f], "ok": ok})
    for name, scene, edit, code in CONTROLS:
        tree = etree.parse(str(SCENES / f"{scene}.x3d"))
        edit(tree.getroot())
        p = tmp / f"{scene}-{code}.x3d"
        tree.write(str(p), encoding="utf-8", xml_declaration=True)
        got = sorted({c for c, _ in WT.check(p)})
        ok = code in got
        bad += not ok
        rows.append({"kind": "negative", "scene": scene, "control": name, "expected": code, "got": got, "ok": ok})
    for r in rows:
        print(("ok   " if r["ok"] else "FAIL ") + f"{r['kind']:8} {r['scene']:13} {r.get('control', 'unedited'):40} want {r['expected']:11} got {r['got']}")
    (ROOT / "tests/last-run.json").write_text(json.dumps({"witness": "x3d.mol/src/witness.py", "controls": rows, "negative": len(CONTROLS),
                                                           "positive": len(POSITIVE), "failed": bad}, indent=1))
    print(f"\n{len(CONTROLS)} negative controls, {len(POSITIVE)} positive controls, {bad} failed")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
