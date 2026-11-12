#!/usr/bin/env python3 -I
"""Data-true witness for x3d.mol scenes: does the X3D draw only what the source structure file says?

  python3 -I src/witness.py scenes/1aay.x3d [more.x3d ...]   # exit 0 only if every scene passes

Independence: this file imports neither gemmi nor the xmol package. It has its own PDB and mmCIF line parser, so a parsing
or selection bug in the generator cannot also hide here. What it shares with the generator, by design, is the written rules:
the guide-point smoothing (1,2,1)/4 inside helices and strands, the 5 rings per residue and 12 vertices per ring, the pLDDT
palette, the 2.5 and 3.0 angstrom zinc rules and the 800-residue focus rule.

One stable code per cause (a scene can fail with several):
  SOURCE_SHA   the source file's sha256 differs from the one written in the scene
  RESIDUES     residue list differs from the source (count, names, numbers, chains)
  FOCUS        the chains kept or omitted differ from the focus rule
  CA           a guide-atom position differs from the source by more than 0.002 angstrom
  TRACE        a cartoon ring is not centred where the source says the backbone is (0.02 angstrom)
  UNITS        residue spacing along the cartoon is not about 3.8 angstrom (nm read as angstrom, or the reverse)
  PLDDT        the stored per-residue confidence or B-factor differs from the source mean (0.01)
  COLOR        a ring's colour is not the palette colour for its residue
  SS_FORMAT    the secondary structure string has the wrong length or letters
  SITE_ZN      a zinc position or the set of zinc ions differs from the source
  SITE_DONORS  donors within 3.0 angstrom differ in number, atom or distance (0.002)
  SITE_BOND    a drawn bond differs from the measured one in length, position or glow
  SITE_LABEL   a drawn label differs from the measured length, to 2 decimals
  SITE_CAGE    a cage is missing, extra or not on the four glowing donors
  PAE          the stored PAE differs from the source JSON (half-angstrom steps), or has the wrong shape
"""
from __future__ import annotations

import gzip
import hashlib
import json
import re
import sys
from pathlib import Path

import numpy as np
from lxml import etree

ROOT = Path(__file__).resolve().parent.parent
AA = set("ALA ARG ASN ASP CYS GLN GLU GLY HIS ILE LEU LYS MET PHE PRO SER THR TRP TYR VAL MSE".split())
NA = set("A C G U T DA DC DG DT DU I DI".split())
BANDS = [(90.0, (0.0, 0.3255, 0.8392)), (70.0, (0.396, 0.796, 0.953)), (50.0, (1.0, 0.859, 0.0745)), (0.0, (1.0, 0.490, 0.2706))]
SSRGB = {"H": (0.93, 0.33, 0.52), "E": (0.97, 0.78, 0.25), "-": (0.55, 0.66, 0.78)}
NUCRGB = (0.25, 0.75, 0.70)
RING, SAMPLES = 12, 5
POS_TOL, TRACE_TOL, COLOR_TOL = 0.002, 0.02, 0.002


def _open(path: Path):
    return gzip.open(path, "rt") if str(path).endswith(".gz") else open(path, "rt")


def parse_source(path: Path) -> list[dict]:
    """Heavy atoms of the first model, first conformer, as dicts. PDB columns or mmCIF _atom_site loop."""
    atoms: list[dict] = []
    with _open(path) as fh:
        lines = fh.read().splitlines()
    if any(l.startswith("_atom_site.") for l in lines):
        cols, i = [], 0
        while i < len(lines) and not lines[i].startswith("_atom_site."):
            i += 1
        while i < len(lines) and lines[i].startswith("_atom_site."):
            cols.append(lines[i].strip()); i += 1
        ix = {c: k for k, c in enumerate(cols)}
        first_model = None
        while i < len(lines) and not lines[i].startswith(("#", "loop_")):
            t = lines[i].split(); i += 1
            if len(t) < len(cols):
                continue
            model = t[ix["_atom_site.pdbx_PDB_model_num"]] if "_atom_site.pdbx_PDB_model_num" in ix else "1"
            first_model = first_model or model
            alt = t[ix["_atom_site.label_alt_id"]]
            el = t[ix["_atom_site.type_symbol"]].upper()
            if model != first_model or alt not in (".", "A") or el in ("H", "D"):
                continue
            icode = t[ix["_atom_site.pdbx_PDB_ins_code"]]
            atoms.append({"rec": t[ix["_atom_site.group_PDB"]], "name": t[ix["_atom_site.label_atom_id"]].strip("\"'"),
                          "res": t[ix["_atom_site.label_comp_id"]], "chain": t[ix["_atom_site.auth_asym_id"]], "num": int(t[ix["_atom_site.auth_seq_id"]]),
                          "icode": "" if icode in ("?", ".") else icode, "el": el,
                          "xyz": np.array([float(t[ix["_atom_site.Cartn_x"]]), float(t[ix["_atom_site.Cartn_y"]]), float(t[ix["_atom_site.Cartn_z"]])]),
                          "b": float(t[ix["_atom_site.B_iso_or_equiv"]])})
        return atoms
    for l in lines:
        if l.startswith("ENDMDL"):
            break
        if l[:6] in ("ATOM  ", "HETATM"):
            if l[16] not in " A":
                continue
            el = (l[76:78].strip() or l[12:16].strip()[:1]).upper()
            if el in ("H", "D"):
                continue
            atoms.append({"rec": l[:6].strip(), "name": l[12:16].strip(), "res": l[17:20].strip(), "chain": l[21], "num": int(l[22:26]),
                          "icode": l[26].strip(), "el": el, "xyz": np.array([float(l[30:38]), float(l[38:46]), float(l[46:54])]), "b": float(l[60:66])})
    return atoms


def residues_of(atoms: list[dict]) -> tuple[list[dict], list[dict]]:
    """Polymer residues (with CA or C4') in file order, and zinc ions."""
    order: dict = {}
    zn = []
    for a in atoms:
        if a["res"] not in AA and a["res"] not in NA:
            if a["el"] == "ZN":
                zn.append(a)
            continue
        k = (a["chain"], a["num"], a["icode"])
        r = order.setdefault(k, {"chain": a["chain"], "num": a["num"], "icode": a["icode"], "name": a["res"], "atoms": []})
        r["atoms"].append(a)
    out = []
    for r in order.values():
        guide = "CA" if r["name"] in AA else "C4'"
        g = [a for a in r["atoms"] if a["name"] == guide]
        if g:
            r["guide"] = g[0]["xyz"]
            r["kind"] = "protein" if r["name"] in AA else "nucleic"
            r["b"] = float(np.mean([a["b"] for a in r["atoms"]]))
            out.append(r)
    return out, zn


def band_rgb(b: float):
    for lo, c in BANDS:
        if b >= lo:
            return c
    return BANDS[-1][1]


def floats(s: str) -> np.ndarray:
    return np.array(s.split(), dtype=np.float64)


class Scene:
    def __init__(self, path: Path):
        self.path = path
        self.root = etree.parse(str(path)).getroot()
        self.meta = {}
        for m in self.root.iter("MetadataString", "MetadataFloat", "MetadataInteger"):
            self.meta[m.get("name")] = m
        self.shapes = {s.get("DEF"): s for s in self.root.iter("Shape") if s.get("DEF")}

    def strings(self, name: str) -> list[str]:
        v = self.meta[name].get("value")
        return [re.sub(r'\\(.)', r'\1', t) for t in re.findall(r'"((?:[^"\\]|\\.)*)"', v)]

    def array(self, name: str) -> np.ndarray:
        return floats(self.meta[name].get("value"))


def check(path: Path) -> list[tuple[str, str]]:
    fails: list[tuple[str, str]] = []
    def bad(code, msg):
        if len(fails) < 60:
            fails.append((code, msg))
    sc = Scene(path)
    kind = sc.strings("kind")[0]
    src_name, src_sha = sc.strings("source")
    folder = ROOT / "data" / ("afdb" if kind == "afdb" else "pdb")
    src = folder / src_name
    if hashlib.sha256(src.read_bytes()).hexdigest() != src_sha:
        bad("SOURCE_SHA", f"{src_name}: sha256 differs from the one in the scene")
    res, zn = residues_of(parse_source(src))
    # focus rule: more than 800 protein residues keeps chains with zinc or nucleic acid only
    focus_note = sc.strings("focus")[0] if "focus" in sc.meta else None
    if sum(1 for r in res if r["kind"] == "protein") > 800:
        keep = {a["chain"] for a in zn} | {r["chain"] for r in res if r["kind"] == "nucleic"}
        omitted = {}
        for r in res:
            if r["chain"] not in keep:
                omitted[r["chain"]] = omitted.get(r["chain"], 0) + 1
        res = [r for r in res if r["chain"] in keep]
        want = f"chains {','.join(dict.fromkeys(r['chain'] for r in res))} drawn; chains {','.join(f'{c}:{n}' for c, n in omitted.items())} (residues) omitted"
        if focus_note != want:
            bad("FOCUS", f"expected {want!r}, scene says {focus_note!r}")
    elif focus_note:
        bad("FOCUS", "scene claims an omission the rule does not make")
    # residues
    labels = sc.strings("residues")
    want_labels = [f"{r['chain']}:{r['name']}:{r['num']}{r['icode']}" for r in res]
    if labels != want_labels:
        n = sum(1 for a, b in zip(labels, want_labels) if a != b)
        bad("RESIDUES", f"{len(labels)} residues in the scene, {len(want_labels)} in the source, {n} labels differ")
        return fails                              # nothing below can be compared
    N = len(res)
    ca = sc.array("ca").reshape(-1, 3)
    if len(ca) != N or np.abs(ca - np.array([r["guide"] for r in res])).max() > POS_TOL:
        bad("CA", f"guide atoms differ from the source by up to {np.abs(ca - np.array([r['guide'] for r in res])).max() if len(ca) == N else 'n/a'} A")
    bname = "plddt" if kind == "afdb" else "bfactor"
    b = sc.array(bname)
    srcb = np.array([r["b"] for r in res])
    if len(b) != N or np.abs(b - srcb).max() > 0.0051:
        bad("PLDDT", f"{bname} differs from the source mean by up to {np.abs(b - srcb).max() if len(b) == N else 'n/a'}")
    ss = sc.strings("ss")[0]
    if len(ss) != N or set(ss) - set("HE-n") or any((c == "n") != (r["kind"] == "nucleic") for c, r in zip(ss, res)):
        bad("SS_FORMAT", f"ss string has {len(ss)} letters for {N} residues or a wrong letter")
        ss = (ss + "-" * N)[:N]
    # cartoon rings
    spacing = []
    for name, shp in sc.shapes.items():
        if not name.startswith(("Cartoon_", "Nucleic_")):
            continue
        its = shp.find("IndexedTriangleSet")
        v = floats(its.find("Coordinate").get("point")).reshape(-1, 3)
        col = floats(its.find("Color").get("color")).reshape(-1, 3)
        rid = None
        for fva in its.findall("FloatVertexAttribute"):
            if fva.get("name") == "resid":
                rid = floats(fva.get("value")).astype(int)
        nring = (len(v) - 2 * (RING + 1)) // RING
        m = (nring - 1) // SAMPLES + 1
        if rid is None or (nring - 1) % SAMPLES or len(v) != nring * RING + 2 * (RING + 1):
            bad("TRACE", f"{name}: ring layout is not {RING} vertices x {SAMPLES} rings per residue")
            continue
        idx = [int(rid[(SAMPLES * i) * RING]) for i in range(m)]
        c = np.array([ca[j] for j in idx])
        # the generator's rule, written here from the spec
        guide = c.copy()
        if name.startswith("Cartoon_"):
            for i in range(1, m - 1):
                if ss[idx[i]] in "HE":
                    guide[i] = (c[i - 1] + 2 * c[i] + c[i + 1]) / 4
        cen = np.array([v[(SAMPLES * i) * RING:(SAMPLES * i + 1) * RING].mean(axis=0) for i in range(m)])
        err = np.linalg.norm(cen - guide, axis=1).max()
        if err > TRACE_TOL:
            bad("TRACE", f"{name}: a ring centre is {err:.3f} A from where the source puts the backbone")
        if name.startswith("Cartoon_"):
            spacing.append(v)
        for i in range(m):
            r = res[idx[i]]
            want = NUCRGB if r["kind"] == "nucleic" else (band_rgb(r["b"]) if kind == "afdb" else SSRGB[ss[idx[i]]])
            got = col[(SAMPLES * i) * RING]
            if np.abs(got - np.array(want)).max() > COLOR_TOL + 0.0006:
                bad("COLOR", f"{name}: ring {i} colour {got.round(3).tolist()} is not {list(want)}")
                break
    if spacing:
        allv = np.vstack(spacing)
        pca = np.array([ca[i] for i, r in enumerate(res) if r["kind"] == "protein"])
        diag_mesh = float(np.linalg.norm(allv.max(axis=0) - allv.min(axis=0)))
        diag_ca = float(np.linalg.norm(pca.max(axis=0) - pca.min(axis=0)))
        if not 0.7 <= diag_mesh / diag_ca <= 1.8:
            bad("UNITS", f"the cartoon is {diag_mesh:.1f} A across but the backbone atoms span {diag_ca:.1f} A: nanometres read as angstrom, or the reverse")
    # zinc sites
    sites = json.loads(sc.strings("sites")[0]) if "sites" in sc.meta else []
    zn_src = [a for a in zn if not (sum(1 for r in res if r["chain"] == a["chain"]) == 0)]
    if len(sites) != len(zn_src):
        bad("SITE_ZN", f"{len(sites)} zinc ions in the scene, {len(zn_src)} in the source (in drawn chains)")
    else:
        eye_tr = {}
        for s in sc.root.iter("Transform"):
            if s.get("DEF"):
                eye_tr[s.get("DEF")] = s
        for site, z in zip(sites, zn_src):
            tag = site["site"]
            if np.abs(np.array(site["zn"]) - z["xyz"]).max() > POS_TOL or tag != f"{z['chain']}{z['num']}":
                bad("SITE_ZN", f"{tag}: zinc position or name differs from the source")
                continue
            tr = eye_tr.get(f"Zn_{tag}")
            if tr is None or np.abs(floats(tr.get("translation")) - z["xyz"]).max() > POS_TOL:
                bad("SITE_ZN", f"{tag}: drawn sphere is not on the source zinc")
            donors = []
            for r in res:
                for a in r["atoms"]:
                    if a["el"] in ("N", "O", "S", "SE"):
                        d = float(np.linalg.norm(a["xyz"] - z["xyz"]))
                        if d < 3.0:
                            donors.append((d, r, a))
            donors.sort(key=lambda t: t[0])
            sd = site["donors"]
            if len(sd) != len(donors) or any(x["atom"] != t[2]["name"] or x["res"] != f"{t[1]['name']}{t[1]['num']}{t[1]['icode']}" or abs(x["d"] - t[0]) > POS_TOL
                                             or x["glow"] != (t[0] < 2.5) for x, t in zip(sd, donors)):
                bad("SITE_DONORS", f"{tag}: donors in the scene {[(x['res'], x['atom'], x['d']) for x in sd]} differ from the source")
                continue
            glow = []
            for j, (d, r, a) in enumerate(donors):
                tb = eye_tr.get(f"Bond_{tag}_{j}")
                if tb is None:
                    bad("SITE_BOND", f"{tag}: bond {j} is not drawn"); continue
                cyl = tb.find(".//Cylinder")
                mid = (z["xyz"] + a["xyz"]) / 2
                want_r = 0.075 if d < 2.5 else 0.04
                if abs(float(cyl.get("height")) - d) > POS_TOL or np.abs(floats(tb.get("translation")) - mid).max() > POS_TOL or abs(float(cyl.get("radius")) - want_r) > 1e-6:
                    bad("SITE_BOND", f"{tag}: bond {j} to {r['name']}{r['num']} {a['name']} differs from the measured {d:.4f} A")
                if d < 2.5:
                    glow.append(a["xyz"])
            for j, (d, r, a) in enumerate(donors):
                if d >= 2.5:
                    continue
                nxt = eye_tr[f"Bond_{tag}_{j}"].getnext()          # the label sits right after its bond
                txt = nxt.find(".//Text") if nxt is not None else None
                mid = (z["xyz"] + a["xyz"]) / 2
                if txt is None or txt.get("string") != f'"{d:.2f} Å"' or np.linalg.norm(floats(nxt.get("translation")) - mid) > 1.2:
                    bad("SITE_LABEL", f"{tag}: label for {r['name']}{r['num']} {a['name']} is not '{d:.2f} Å' next to its bond")
            cage = sc.shapes.get(f"Cage_{tag}")
            if len(glow) == 4:
                if cage is None:
                    bad("SITE_CAGE", f"{tag}: four donors glow but no cage is drawn")
                else:
                    pts = floats(cage.find(".//Coordinate").get("point")).reshape(-1, 3)
                    if len(pts) != 4 or np.abs(pts - np.array(glow)).max() > POS_TOL:
                        bad("SITE_CAGE", f"{tag}: cage vertices are not the four glowing donors")
            elif cage is not None:
                bad("SITE_CAGE", f"{tag}: a cage is drawn with {len(glow)} glowing donors")
    # PAE
    if "pae_half_angstrom" in sc.meta:
        q = sc.array("pae_half_angstrom")
        paef = ROOT / "data/afdb" / sc.strings("pae_source")[0]
        if hashlib.sha256(paef.read_bytes()).hexdigest() != sc.strings("pae_sha256")[0]:
            bad("PAE", "PAE source file sha256 differs from the one in the scene")
        want = np.clip(np.rint(2 * np.array(json.loads(paef.read_text())[0]["predicted_aligned_error"])), 0, 63).astype(int)
        if len(q) != N * N or want.shape != (N, N) or not np.array_equal(q.astype(int).reshape(N, N), want):
            bad("PAE", f"stored PAE ({len(q)} values) differs from the source ({want.size}) in shape or value")
    return fails


def main() -> int:
    code = 0
    for p in sys.argv[1:]:
        f = check(Path(p))
        print(f"{'FAIL' if f else 'pass'}  {p}" + "".join(f"\n      {c}: {m}" for c, m in f[:6]))
        code |= bool(f)
    return code


if __name__ == "__main__":
    raise SystemExit(main())
