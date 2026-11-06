"""Metal-site witness for molecular structures and trajectories (x3d.STEM "Proteins in Motion", zinc fingers).

Reads PDB-format coordinates (ATOM and HETATM records, MODEL/ENDMDL frames) with the standard library
only, and checks every declared metal site: which atoms coordinate it, at what distances, in what
geometry, with which ligand class, and in how many frames. Every predicate raises (need), so `python -O`
cannot turn a red site green (law 18). A pass reports what it read (law 36): atoms, frames, metals found,
sites checked.

Why it exists (grade L): a molecular dynamics run can finish, conserve energy and still lose its zinc,
change its ligands or bind the wrong histidine nitrogen; energy conservation admits a run, it does not
confirm the site the captions describe (law 21). A scene ten times too small (nanometres read as
angstrom) validates as X3D (law 2). This witness checks the site itself.

Thresholds live in the site spec, never in this file (law 28: fix the instrument, not the threshold).
DEFAULT_WINDOWS are typical crystallographic ranges for Zn(II), graded L (from memory of the protein and
small-molecule surveys of metal-ligand distances; confirm against a fetched survey before quoting them).
The tau4 index is Yang, Powell and Houser's four-coordinate geometry index: (360 - (a + b)) / 141, with a
and b the two largest ligand-metal-ligand angles; 1 is tetrahedral, 0 is square planar (L).

Stable diagnostics: SITE_PARSE, SITE_SPEC, SITE_NO_METAL, SITE_UNITS, SITE_COORDINATION, SITE_CLASS,
SITE_DONOR, SITE_DISTANCE, SITE_GEOMETRY, SITE_INTACT_FRACTION.

Limits (declared before the first real run):
- PDB format only; mmCIF is not read (convert first). Alternate locations other than blank or A are skipped.
- Donors are found by distance within search_radius; a donor beyond it counts as absent (SITE_COORDINATION),
  a donor inside it but outside its window is SITE_DISTANCE.
- The units check is a gross-error check (median nearest-neighbour distance below 0.5 means nanometres);
  it cannot catch a scale error of less than a factor of about 3.
- Ligand class is the one-letter residue code of each protein donor in chain and sequence order; waters
  and other non-protein donors are counted for coordination but do not enter the class string.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

from .core import GateError, need

SCHEMA = "loom.metal-site-spec/1"

# Donor atoms by residue name, including the Amber names for deprotonated or tautomer-fixed residues.
DONORS = {
    "CYS": ("SG",), "CYM": ("SG",), "CYX": ("SG",),
    "HIS": ("ND1", "NE2"), "HID": ("ND1", "NE2"), "HIE": ("ND1", "NE2"), "HIP": ("ND1", "NE2"),
    "ASP": ("OD1", "OD2"), "ASH": ("OD1", "OD2"), "GLU": ("OE1", "OE2"), "GLH": ("OE1", "OE2"),
    "HOH": ("O",), "WAT": ("O",),
}
ONE_LETTER = {"CYS": "C", "CYM": "C", "CYX": "C", "HIS": "H", "HID": "H", "HIE": "H", "HIP": "H",
              "ASP": "D", "ASH": "D", "GLU": "E", "GLH": "E"}
DEFAULT_WINDOWS = {"ZN": {"S": [2.20, 2.45], "N": [1.95, 2.20], "O": [1.90, 2.30]}}


def parse_pdb(text: str) -> list[list[dict]]:
    """Return frames, each a list of atoms. A file without MODEL records is one frame."""
    frames: list[list[dict]] = []
    cur: list[dict] = []
    in_model = False
    for n, line in enumerate(text.splitlines(), 1):
        rec = line[:6].strip()
        if rec == "MODEL":
            need(not in_model, "SITE_PARSE", f"line {n}: MODEL inside MODEL")
            in_model, cur = True, []
        elif rec == "ENDMDL":
            need(in_model, "SITE_PARSE", f"line {n}: ENDMDL without MODEL")
            frames.append(cur); in_model, cur = False, []
        elif rec in ("ATOM", "HETATM"):
            if line[16:17] not in (" ", "A", ""):
                continue
            try:
                x, y, z = float(line[30:38]), float(line[38:46]), float(line[46:54])
            except ValueError:
                raise GateError("SITE_PARSE", f"line {n}: coordinates are not numbers") from None
            need(all(math.isfinite(v) for v in (x, y, z)), "SITE_PARSE", f"line {n}: nonfinite coordinate")
            name = line[12:16].strip()
            element = line[76:78].strip().upper() or "".join(c for c in name if c.isalpha())[:1].upper()
            try:
                resseq = int(line[22:26])
            except ValueError:
                raise GateError("SITE_PARSE", f"line {n}: residue number is not an integer") from None
            cur.append({"name": name, "resname": line[17:20].strip().upper(), "chain": line[21:22].strip(),
                        "resseq": resseq, "element": element, "xyz": (x, y, z)})
    need(not in_model, "SITE_PARSE", "MODEL without ENDMDL")
    if cur:
        frames.append(cur)
    need(frames and all(frames), "SITE_PARSE", "no atoms")
    need(len({len(f) for f in frames}) == 1, "SITE_PARSE", "frames hold different numbers of atoms")
    return frames


def _dist(a, b) -> float:
    return math.sqrt(sum((p - q) ** 2 for p, q in zip(a, b)))


def _angle(m, a, b) -> float:
    u = [p - q for p, q in zip(a, m)]; v = [p - q for p, q in zip(b, m)]
    nu, nv = math.sqrt(sum(c * c for c in u)), math.sqrt(sum(c * c for c in v))
    c = sum(p * q for p, q in zip(u, v)) / (nu * nv)
    return math.degrees(math.acos(max(-1.0, min(1.0, c))))


def tau4(metal, ligands) -> float:
    """Yang-Powell-Houser tau4 for a four-coordinate site: 1 tetrahedral, 0 square planar."""
    need(len(ligands) == 4, "SITE_GEOMETRY", f"tau4 needs 4 ligands, got {len(ligands)}")
    angles = sorted((_angle(metal, ligands[i], ligands[j]) for i in range(4) for j in range(i + 1, 4)), reverse=True)
    return (360.0 - (angles[0] + angles[1])) / 141.0


def median_nearest_neighbour(atoms: list[dict], limit: int = 400) -> float:
    pts = [a["xyz"] for a in atoms[:limit]]
    need(len(pts) >= 2, "SITE_UNITS", "too few atoms to check units")
    nn = sorted(min(_dist(p, q) for j, q in enumerate(pts) if j != i) for i, p in enumerate(pts))
    return nn[len(nn) // 2]


def load_spec(spec: dict) -> dict:
    need(isinstance(spec, dict) and spec.get("schema") == SCHEMA, "SITE_SPEC", f"schema must be {SCHEMA}")
    need(isinstance(spec.get("sites"), list) and spec["sites"], "SITE_SPEC", "sites: at least one")
    r = spec.get("search_radius", 3.0)
    need(type(r) in (int, float) and 2.5 <= r <= 3.5, "SITE_SPEC", "search_radius must lie in 2.5 to 3.5 angstrom")
    f = spec.get("min_intact_fraction", 1.0)
    need(type(f) in (int, float) and 0.0 < f <= 1.0, "SITE_SPEC", "min_intact_fraction in (0, 1]")
    for s in spec["sites"]:
        m = s.get("metal") or {}
        need(isinstance(m.get("resname"), str) and m["resname"], "SITE_SPEC", "site.metal.resname")
        need(type(s.get("coordination")) is int and 2 <= s["coordination"] <= 8, "SITE_SPEC", "site.coordination")
        need(s.get("class") is None or (isinstance(s["class"], str) and s["class"].isalpha()), "SITE_SPEC", "site.class")
        t = s.get("tau4_min")
        need(t is None or (type(t) in (int, float) and 0.0 <= t <= 1.0), "SITE_SPEC", "site.tau4_min in [0, 1]")
        windows = s.get("windows") or DEFAULT_WINDOWS.get(m["resname"].upper())
        need(isinstance(windows, dict) and windows, "SITE_SPEC", f"no distance windows for {m['resname']}")
        for el, w in windows.items():
            need(isinstance(w, list) and len(w) == 2 and all(type(v) in (int, float) for v in w) and 0 < w[0] < w[1],
                 "SITE_SPEC", f"window {el}")
    return spec


def _metals(atoms: list[dict], m: dict) -> list[dict]:
    hits = [a for a in atoms if a["resname"] == m["resname"].upper()
            and ("chain" not in m or a["chain"] == m["chain"]) and ("resseq" not in m or a["resseq"] == m["resseq"])]
    need(hits, "SITE_NO_METAL", json.dumps(m, sort_keys=True))
    return hits


def check_site(atoms: list[dict], metal: dict, site: dict, radius: float) -> dict:
    """One metal in one frame. Raises on the first broken rule; returns the measured site otherwise."""
    windows = site.get("windows") or DEFAULT_WINDOWS[site["metal"]["resname"].upper()]
    donors = [a for a in atoms if a is not metal and a["name"] in DONORS.get(a["resname"], ())
              and _dist(a["xyz"], metal["xyz"]) <= radius]
    tag = f"{metal['resname']} {metal['chain']}{metal['resseq']}"
    need(len(donors) == site["coordination"], "SITE_COORDINATION",
         f"{tag}: {len(donors)} donors within {radius} A, declared {site['coordination']}")
    protein = sorted((d for d in donors if d["resname"] in ONE_LETTER), key=lambda d: (d["chain"], d["resseq"]))
    klass = "".join(ONE_LETTER[d["resname"]] for d in protein)
    if site.get("class"):
        need(klass == site["class"].upper(), "SITE_CLASS", f"{tag}: ligands {klass}, declared {site['class']}")
    for res, atom in (site.get("donor_atoms") or {}).items():
        for d in donors:
            if d["resname"] in (res,) or ONE_LETTER.get(d["resname"]) == ONE_LETTER.get(res, "?"):
                need(d["name"] == atom, "SITE_DONOR", f"{tag}: {d['resname']} {d['resseq']} binds through {d['name']}, declared {atom}")
    dists = []
    for d in donors:
        r = _dist(d["xyz"], metal["xyz"])
        w = windows.get(d["element"])
        need(w is not None, "SITE_DISTANCE", f"{tag}: no window for donor element {d['element']}")
        need(w[0] <= r <= w[1], "SITE_DISTANCE", f"{tag}: {d['resname']} {d['resseq']} {d['name']} at {r:.3f} A, window {w}")
        dists.append({"donor": f"{d['resname']}{d['resseq']}.{d['name']}", "element": d["element"], "angstrom": round(r, 4)})
    out = {"site": tag, "class": klass, "coordination": len(donors), "distances": dists}
    if len(donors) == 4:
        t = tau4(metal["xyz"], [d["xyz"] for d in donors])
        out["tau4"] = round(t, 4)
        if site.get("tau4_min") is not None:
            need(t >= site["tau4_min"], "SITE_GEOMETRY", f"{tag}: tau4 {t:.3f} below {site['tau4_min']}")
    return out


def check(text: str, spec: dict) -> dict:
    """Check every declared site in every frame. Returns measurements; raises on the first broken rule."""
    spec = load_spec(spec)
    frames = parse_pdb(text)
    nn = median_nearest_neighbour(frames[0])
    need(nn >= 0.5, "SITE_UNITS", f"median nearest-neighbour distance {nn:.3f}: nanometres read as angstrom?")
    radius, need_fraction = float(spec.get("search_radius", 3.0)), float(spec.get("min_intact_fraction", 1.0))
    sites_out = []
    for site in spec["sites"]:
        for metal0 in _metals(frames[0], site["metal"]):
            idx = frames[0].index(metal0)
            per_frame, failures = [], []
            for i, atoms in enumerate(frames):
                try:
                    per_frame.append(check_site(atoms, atoms[idx], site, radius))
                except GateError as e:
                    if len(frames) == 1:
                        raise
                    failures.append({"frame": i, "code": e.code, "detail": e.detail})
            intact = len(per_frame) / len(frames)
            first = (f"; first failure at frame {failures[0]['frame']}: {failures[0]['code']} ({failures[0]['detail']})"
                     if failures else "")
            need(intact >= need_fraction, "SITE_INTACT_FRACTION",
                 f"{metal0['resname']} {metal0['chain']}{metal0['resseq']}: intact in {len(per_frame)} of {len(frames)} frames, "
                 f"declared at least {need_fraction}{first}")
            all_d = [d["angstrom"] for f in per_frame for d in f["distances"]]
            taus = [f["tau4"] for f in per_frame if "tau4" in f]
            sites_out.append({"site": per_frame[0]["site"], "class": per_frame[0]["class"],
                              "frames_intact": len(per_frame), "frames": len(frames),
                              "distance_min": min(all_d), "distance_max": max(all_d),
                              "tau4_min": min(taus) if taus else None, "failures": failures[:5],
                              "first_frame": per_frame[0]})
    return {"inventory": {"atoms_per_frame": len(frames[0]), "frames": len(frames),
                          "metals_checked": len(sites_out), "median_nn_angstrom": round(nn, 4)},
            "sites": sites_out}


def check_files(paths: list[Path], spec: dict) -> dict:
    need(paths, "SITE_PARSE", "no coordinate files matched")
    return {p.as_posix(): check(p.read_text(), spec) for p in paths}
