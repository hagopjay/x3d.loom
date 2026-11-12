#!/usr/bin/env python3 -I
"""Build the x3d.mol catalogue: one validated-X3D scene per structure plus scenes/catalog.json.

  /path/to/python -I src/build.py --out scenes            # all 14 zinc finger entries and the 5 AlphaFold models
  /path/to/python -I src/build.py --out scenes --only 1aay,AF-P26651

Needs gemmi, numpy and pydssp (free; see x3d.mol/README.md). Nothing here is random: building twice gives the same bytes.
"""
from __future__ import annotations

import argparse
import dataclasses
import gzip
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
from xmol import mesh as M, ss as SS, structure as S, x3dwrite as W  # noqa: E402

BUILDER = "x3d.mol/src/build.py"
PLDDT_BANDS = [(90.0, (0.0, 0.3255, 0.8392)), (70.0, (0.396, 0.796, 0.953)), (50.0, (1.0, 0.859, 0.0745)), (0.0, (1.0, 0.490, 0.2706))]
BAND_NAME = ["very low (< 50)", "low (50 to 70)", "confident (70 to 90)", "very high (> 90)"]
SS_RGB = {"H": (0.93, 0.33, 0.52), "E": (0.97, 0.78, 0.25), "-": (0.55, 0.66, 0.78)}
NUC_RGB = (0.25, 0.75, 0.70)
BASE_RGB = {"A": (0.95, 0.45, 0.35), "DA": (0.95, 0.45, 0.35), "T": (0.98, 0.85, 0.30), "DT": (0.98, 0.85, 0.30), "U": (0.98, 0.85, 0.30),
            "DU": (0.98, 0.85, 0.30), "G": (0.45, 0.85, 0.45), "DG": (0.45, 0.85, 0.45), "C": (0.40, 0.60, 1.0), "DC": (0.40, 0.60, 1.0)}
ELEMENT_RGB = {"C": (0.55, 0.62, 0.68), "N": (0.25, 0.45, 1.0), "O": (1.0, 0.28, 0.25), "S": (1.0, 0.85, 0.25), "P": (1.0, 0.55, 0.1),
               "SE": (0.9, 0.6, 0.2), "ZN": (0.70, 0.80, 0.92)}
RING_ATOMS = {"N1", "C2", "N3", "C4", "C5", "C6", "N7", "C8", "N9"}
BACKBONE = {"N", "C", "O", "OXT"}
GLOW = 2.5
SEARCH = 3.0
LICENCE = {"pdb": "Coordinates: wwPDB, CC0 1.0", "afdb": "Model: AlphaFold Protein Structure Database (DeepMind and EMBL-EBI), CC-BY 4.0"}


def plddt_rgb(b: float):
    for lo, c in PLDDT_BANDS:
        if b >= lo:
            return c
    return PLDDT_BANDS[-1][1]


def plddt_band(b: float) -> int:
    return 3 if b >= 90 else 2 if b >= 70 else 1 if b >= 50 else 0


def load_pdb_pins() -> dict:
    spec = importlib.util.spec_from_file_location("zinc_structures", ROOT.parent / "kit/examples/zinc_structures.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.STRUCTURES


def phys(base=(1, 1, 1), metallic=0.0, rough=0.45, emissive=(0, 0, 0), transp=0.0) -> str:
    return (f"<PhysicalMaterial baseColor='{W.nums(base)}' metallic='{W.num(metallic)}' roughness='{W.num(rough)}' "
            f"emissiveColor='{W.nums(emissive)}' transparency='{W.num(transp)}'/>")


def find_sites(st: S.Structure) -> list[dict]:
    sites = []
    for z in st.metals:
        donors = []
        for r in st.residues:
            for nm, el, xyz in r.atoms:
                if el in ("N", "O", "S", "SE"):
                    d = float(np.linalg.norm(xyz - z.xyz))
                    if d < SEARCH:
                        donors.append({"d": d, "res": r, "atom": nm, "el": el, "xyz": xyz, "glow": d < GLOW})
        donors.sort(key=lambda x: x["d"])
        sites.append({"metal": z, "donors": donors})
    return sites


def site_view(site: dict) -> tuple[np.ndarray, np.ndarray]:
    """Eye position and orientation for a zinc: look along the direction in which the donors spread least."""
    z = site["metal"].xyz
    pts = np.array([d["xyz"] for d in site["donors"] if d["glow"]] or [z + 1.0])
    c = pts - pts.mean(axis=0)
    if len(pts) >= 3:
        axis = np.linalg.svd(c)[2][-1]
    else:
        axis = np.array([0.0, 0.0, 1.0])
    eye = z + 15.0 * axis
    return eye, z


def look_at(eye: np.ndarray, target: np.ndarray) -> str:
    f = target - eye
    f = f / np.linalg.norm(f)
    up = np.array([0.0, 1.0, 0.0])
    if abs(f[1]) > 0.98:
        up = np.array([0.0, 0.0, 1.0])
    s = np.cross(f, up); s /= np.linalg.norm(s)
    u = np.cross(s, f)
    rm = np.array([s, u, -f]).T                          # columns: right, up, back
    ang = float(np.arccos(np.clip((np.trace(rm) - 1) / 2, -1, 1)))
    if ang < 1e-6:
        return "0 0 1 0"
    ax = np.array([rm[2, 1] - rm[1, 2], rm[0, 2] - rm[2, 0], rm[1, 0] - rm[0, 1]])
    if np.linalg.norm(ax) < 1e-6:                        # 180 degrees
        ax = np.sqrt(np.clip((np.diag(rm) + 1) / 2, 0, None))
    ax = ax / np.linalg.norm(ax)
    return f"{W.num(ax[0], 5)} {W.num(ax[1], 5)} {W.num(ax[2], 5)} {W.num(ang, 5)}"


def focus(st: S.Structure, limit: int = 800):
    """Very large complexes (the cryo-EM entries) keep only chains that hold zinc or are nucleic; the rest is counted, not drawn."""
    from collections import Counter
    if sum(1 for r in st.residues if r.kind == "protein") <= limit:
        return st, None
    keep = {m.chain for m in st.metals} | {r.chain for r in st.residues if r.kind == "nucleic"}
    kept = [r for r in st.residues if r.chain in keep]
    for i, r in enumerate(kept):
        r.index = i
    omitted = dict(Counter(r.chain for r in st.residues if r.chain not in keep))
    return dataclasses.replace(st, residues=kept, chains=[c for c in st.chains if c in keep]), omitted


def build_scene(st: S.Structure, title: str, kind: str, pae: np.ndarray | None, extra_meta: dict, builder_sha: str) -> tuple[str, dict]:
    S_, omitted = focus(st)
    if omitted:
        extra_meta = dict(extra_meta, focus=f"chains {','.join(S_.chains)} drawn; chains {','.join(f'{c}:{n}' for c, n in omitted.items())} (residues) omitted")
        title += f" [chains {','.join(S_.chains)} only]"
    SS.assign(S_)
    agreement = SS.agreement(S_)
    res = S_.residues
    n_res = len(res)
    conf = S_.confidence
    default_rgb = (lambda r: plddt_rgb(r.b)) if conf else (lambda r: NUC_RGB if r.kind == "nucleic" else SS_RGB[r.ss])
    attrs = {"resid": lambda r: r.index, "ss": lambda r: {"-": 0, "H": 1, "E": 2}[r.ss] if r.kind == "protein" else 3}
    attrs["plddt" if conf else "bfactor"] = lambda r: r.b
    shapes = []
    stats = {"verts": 0, "tris": 0}
    for kind_ in ("protein", "nucleic"):
        for k, seg in enumerate(S.segments(res, kind_)):
            if len(seg) < 2:
                continue
            mh = M.ribbon(seg, default_rgb, attrs)
            stats["verts"] += mh.n; stats["tris"] += len(mh.tri)
            tag = f"{'Cartoon' if kind_ == 'protein' else 'Nucleic'}_{seg[0].chain}{k}"
            shapes.append(W.shape_mesh(mh, tag, phys(rough=0.42 if kind_ == "protein" else 0.55)))
    # nucleic bases as rungs
    rung_parts = []
    for r in res:
        if r.kind != "nucleic":
            continue
        ring = [xyz for nm, el, xyz in r.atoms if nm in RING_ATOMS]
        c1 = [xyz for nm, el, xyz in r.atoms if nm == "C1'"]
        if ring and c1:
            pv, pt = M.prism(c1[0], np.mean(ring, axis=0), 0.33)
            rgb = np.tile(BASE_RGB.get(r.name, (0.8, 0.8, 0.8)), (len(pv), 1))
            ax = (np.mean(ring, axis=0) - c1[0]); ax /= np.linalg.norm(ax)
            rad = pv - np.vstack([np.tile(c1[0], (6, 1)), np.tile(np.mean(ring, axis=0), (6, 1))])
            rung_parts.append(M.Mesh(pv, M.unit(rad - np.sum(rad * ax, axis=1, keepdims=True) * ax), rgb, pt,
                                     {k_: np.full(len(pv), f(r), dtype=np.float64) for k_, f in attrs.items()}))
    if rung_parts:
        mh = M.merge(rung_parts)
        stats["verts"] += mh.n; stats["tris"] += len(mh.tri)
        shapes.append(W.shape_mesh(mh, "BaseRungs", phys(rough=0.5)))
    # zinc sites
    sites = find_sites(S_)
    site_x3d, viewpoints, site_meta = [], [], []
    lig_res: dict[int, S.Residue] = {}
    for si, site in enumerate(sites):
        z = site["metal"]
        tag = f"{z.chain}{z.num}"
        site_x3d.append(f"<Transform DEF='Zn_{tag}' translation='{W.nums(z.xyz)}'><Shape><Appearance>{phys((0.72, 0.80, 0.92), 1.0, 0.18)}</Appearance>"
                        f"<Sphere radius='0.85'/></Shape></Transform>")
        eye, tgt = site_view(site)
        viewpoints.append(f"<Viewpoint description='Site {tag}' position='{W.nums(eye)}' orientation='{look_at(eye, tgt)}' "
                          f"centerOfRotation='{W.nums(tgt)}' fieldOfView='0.6'/>")
        for dj, d in enumerate(site["donors"]):
            p, q = z.xyz, d["xyz"]
            mid = (p + q) / 2
            ln = float(np.linalg.norm(q - p))
            em = (1.0, 0.62, 0.15) if d["glow"] else (0.0, 0.0, 0.0)
            base = (1.0, 0.78, 0.35) if d["glow"] else (0.45, 0.5, 0.55)
            site_x3d.append(f"<Transform DEF='Bond_{tag}_{dj}' translation='{W.nums(mid)}' rotation='{W.rotation_y_to(q - p)}'><Shape><Appearance>"
                            f"{phys(base, 0.0, 0.4, em, 0.0 if d['glow'] else 0.55)}</Appearance><Cylinder radius='{'0.075' if d['glow'] else '0.04'}' height='{W.num(ln, 4)}' "
                            f"top='false' bottom='false'/></Shape></Transform>")
            if d["glow"]:
                lig_res[d["res"].index] = d["res"]
                lab = mid + 0.0
                eye_dir = (eye - tgt) / np.linalg.norm(eye - tgt)
                lab = mid + 1.1 * eye_dir
                site_x3d.append(f"<Transform translation='{W.nums(lab)}'><Billboard axisOfRotation='0 0 0'><Shape><Appearance>"
                                f"<Material diffuseColor='1 0.9 0.6' emissiveColor='1 0.82 0.45'/></Appearance><Text string='\"{ln:.2f} Å\"'>"
                                f"<FontStyle family='\"SANS\"' size='0.5' justify='\"MIDDLE\" \"MIDDLE\"'/></Text></Shape></Billboard></Transform>")
        glow = [d for d in site["donors"] if d["glow"]]
        if len(glow) == 4:
            pts = np.array([d["xyz"] for d in glow])
            site_x3d.append(f"<Shape DEF='Cage_{tag}'><Appearance>{phys((0.55, 0.75, 1.0), 0.0, 0.3, (0.05, 0.12, 0.2), 0.78)}</Appearance>"
                            f"<IndexedFaceSet coordIndex='0 1 2 -1 0 1 3 -1 0 2 3 -1 1 2 3 -1' solid='false' creaseAngle='0'><Coordinate point='{W.nums(pts)}'/></IndexedFaceSet></Shape>")
        site_meta.append({"site": tag, "zn": [round(float(x), 3) for x in z.xyz],
                          "donors": [{"res": d["res"].label, "chain": d["res"].chain, "atom": d["atom"], "d": round(d["d"], 4), "glow": d["glow"], "index": d["res"].index}
                                     for d in site["donors"]]})
    if lig_res:
        trimmed = []
        for r in lig_res.values():
            donors_here = {d["atom"] for s in sites for d in s["donors"] if d["res"].index == r.index and d["glow"]}
            keep = [a for a in r.atoms if a[0] not in BACKBONE or a[0] in donors_here]
            trimmed.append(dataclasses.replace(r, atoms=keep))
        mh = M.sticks(trimmed, lambda el, nm: ELEMENT_RGB.get(el, (0.7, 0.7, 0.7)))
        stats["verts"] += mh.n; stats["tris"] += len(mh.tri)
        shapes.append(W.shape_mesh(mh, "LigandSticks", phys(rough=0.4)))
    # scene extent
    allv = np.array([r.ca for r in res])
    ctr = allv.mean(axis=0)
    rad = float(np.linalg.norm(allv - ctr, axis=1).max()) + 4.0
    vp0 = f"<Viewpoint description='Overview' position='{W.nums(ctr + np.array([0, 0, rad * 2.6]))}' orientation='0 0 1 0' centerOfRotation='{W.nums(ctr)}' fieldOfView='0.7'/>"
    # metadata block
    meta = [W.mstr("schema", ["x3d.mol/1"]), W.mstr("kind", [kind]), W.mstr("confidence", ["pLDDT" if conf else "none"]),
            W.mstr("source", [S_.source_file, S_.source_sha256]), W.mstr("chains", S_.chains),
            W.mstr("residues", [f"{r.chain}:{r.name}:{r.num}{r.icode}" for r in res]),
            W.mstr("ss", ["".join(r.ss if r.kind == "protein" else "n" for r in res)]),
            W.mflt("ca", np.array([r.ca for r in res]), 3), W.mflt("plddt" if conf else "bfactor", np.array([r.b for r in res]), 2)]
    for k, v in extra_meta.items():
        meta.append(W.mstr(k, [v]))
    if pae is not None:
        q = np.clip(np.rint(pae * 2), 0, 63).astype(int)
        meta += [W.mint("pae_half_angstrom", q.ravel()), W.mflt("pae_scale", [0.5], 2)]
    if site_meta:
        meta.append(W.mstr("sites", [json.dumps(site_meta, separators=(",", ":"))]))
    head = ("<?xml version='1.0' encoding='UTF-8'?>\n"
            "<X3D profile='Interchange' version='4.0' xmlns:xsd='http://www.w3.org/2001/XMLSchema-instance' "
            "xsd:noNamespaceSchemaLocation='https://www.web3d.org/specifications/x3d-4.0.xsd'>\n"
            "<head><component name='Shape' level='2'/><component name='Lighting' level='2'/><component name='Shaders' level='1'/><component name='Text' level='1'/><component name='Navigation' level='2'/>"
            f"<meta name='title' content='{W.esc(title)}'/>"
            f"<meta name='description' content='One unit is one angstrom. Colour is baked per vertex; per-vertex resid, ss and {'plddt' if conf else 'bfactor'} ride along as FloatVertexAttribute. "
            "A bond to zinc glows only while it measures under 2.5 angstrom. Materials and lights are look, not data.'/>"
            f"<meta name='source' content='{W.esc(S_.source_file)} sha256 {S_.source_sha256}'/>"
            f"<meta name='generator' content='{BUILDER} sha256 {builder_sha}'/>"
            f"<meta name='license' content='{W.esc(LICENCE[kind])}'/></head>\n")
    body = ["<Scene>", f"<WorldInfo title='{W.esc(title)}'><MetadataSet containerField='metadata' name='xmol' reference='x3d.mol/1'>{''.join(meta)}</MetadataSet></WorldInfo>",
            "<NavigationInfo type='\"EXAMINE\" \"ANY\"' headlight='false'/>", "<Background skyColor='0.02 0.03 0.05'/>",
            "<DirectionalLight DEF='Key' direction='-0.64 -0.74 -0.2' intensity='2.2' color='1 0.95 0.87'/>",
            "<DirectionalLight DEF='Fill' direction='-0.05 0.05 -1' intensity='1.0' color='0.42 0.79 1'/>",
            "<DirectionalLight DEF='Rim' direction='0.89 -0.41 0.2' intensity='1.4' color='1 0.74 0.36'/>", vp0] + viewpoints + shapes + site_x3d + ["</Scene>", "</X3D>\n"]
    text = head + "\n".join(body)
    info = {"title_override": title if omitted else None, "omitted_chains": omitted, "residues": n_res, "chains": S_.chains, "sites": site_meta, "verts": stats["verts"], "tris": stats["tris"],
            "dssp_agreement": agreement, "ss_counts": {k: sum(1 for r in res if r.kind == "protein" and r.ss == k) for k in "HE-"},
            "mean_plddt": round(float(np.mean([r.b for r in res])), 2) if conf else None,
            "plddt_bands": ([sum(1 for r in res if plddt_band(r.b) == b) for b in range(4)] if conf else None)}
    return text, info


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    only = {x.strip().lower() for x in a.only.split(",") if x.strip()}
    builder_sha = hashlib.sha256(b"".join(p.read_bytes() for p in sorted(HERE.rglob("*.py")))).hexdigest()
    cites = json.loads((ROOT / "data/pdb/CITATIONS.json").read_text())
    pins = load_pdb_pins()
    catalog = []
    for pid, (desc, method, sha, sitesdecl) in pins.items():
        if only and pid not in only:
            continue
        f = ROOT / "data/pdb" / f"pdb{pid}.ent.gz"
        if hashlib.sha256(f.read_bytes()).hexdigest() != sha:
            sys.exit(f"{f.name}: sha256 differs from the pin in zinc_structures.py")
        st = S.read(f, pid.upper(), confidence=False)
        title = f"{pid.upper()}: {desc}"
        text, info = build_scene(st, title, "pdb", None, {"method": method}, builder_sha)
        path = out / f"{pid}.x3d"
        path.write_text(text, encoding="utf-8")
        catalog.append({"id": pid, "kind": "pdb", "title": info.pop("title_override") or title, "method": method, "file": f"scenes/{pid}.x3d", "bytes": path.stat().st_size,
                        "gz_bytes": len(gzip.compress(text.encode(), 9, mtime=0)), "sha256": hashlib.sha256(text.encode()).hexdigest(),
                        "source": {"file": st.source_file, "sha256": st.source_sha256, "n_models": st.n_models}, "citation": cites.get(pid.lower(), {}), **info})
        print(f"{pid}: {info['residues']} residues, {len(info['sites'])} sites, {info['verts']} verts, {path.stat().st_size // 1024} KB")
    afpins = json.loads((ROOT / "data/afdb/PINS.json").read_text())
    for name, p in afpins.items():
        if not name.endswith(".cif"):
            continue
        ident = name.split("-model")[0]
        if only and ident.lower() not in only:
            continue
        cif = ROOT / "data/afdb" / name
        if hashlib.sha256(cif.read_bytes()).hexdigest() != p["sha256"]:
            sys.exit(f"{name}: sha256 differs from PINS.json")
        paef = ROOT / "data/afdb" / name.replace("model", "predicted_aligned_error").replace(".cif", ".json")
        if hashlib.sha256(paef.read_bytes()).hexdigest() != afpins[paef.name]["sha256"]:
            sys.exit(f"{paef.name}: sha256 differs from PINS.json")
        pae = np.array(json.loads(paef.read_text())[0]["predicted_aligned_error"], dtype=np.float64)
        st = S.read(cif, ident, confidence=True)
        title = f"{ident}: {p['description']} ({p['gene']}), AlphaFold DB model v6"
        text, info = build_scene(st, title, "afdb", pae, {"uniprot": p["uniprot"], "pae_source": paef.name, "pae_sha256": afpins[paef.name]["sha256"]}, builder_sha)
        path = out / f"{ident}.x3d"
        path.write_text(text, encoding="utf-8")
        info.pop("title_override")
        catalog.append({"id": ident, "kind": "afdb", "title": title, "uniprot": p["uniprot"], "gene": p["gene"], "file": f"scenes/{ident}.x3d",
                        "bytes": path.stat().st_size, "gz_bytes": len(gzip.compress(text.encode(), 9, mtime=0)),
                        "sha256": hashlib.sha256(text.encode()).hexdigest(),
                        "source": {"file": st.source_file, "sha256": st.source_sha256, "url": p["url"], "created": p["created"],
                                   "pae_file": paef.name, "pae_sha256": afpins[paef.name]["sha256"]}, "pae": True, **info})
        print(f"{ident}: {info['residues']} residues, mean pLDDT {info['mean_plddt']}, {info['verts']} verts, {path.stat().st_size // 1024} KB")
    (out / "catalog.json").write_text(json.dumps({"schema": "x3d.mol.catalog/1", "builder_sha256": builder_sha, "scenes": catalog}, indent=1))
    print(f"catalog: {len(catalog)} scenes")


if __name__ == "__main__":
    main()
