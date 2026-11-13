"""Geometry for the cartoon, the nucleic tubes and the ball-and-stick residues. numpy only, no randomness: the same input gives
the same bytes (the build checks it by building twice).

The cartoon rings are laid out so a reader can decode them: every ring has RING vertices and every residue interval has SAMPLES
rings, so ring r of a segment belongs to residue interval r // SAMPLES. witness.py relies on that layout.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .structure import COVALENT, Residue

RING = 12          # vertices per cross-section
SAMPLES = 5        # rings per residue interval
# half-width a, half-thickness b, superellipse exponent n (2 = ellipse, larger = boxier)
SHAPE = {"-": (0.27, 0.27, 2.0), "H": (1.15, 0.20, 2.6), "E": (1.05, 0.17, 4.0)}
ARROW = 1.95       # strand arrow base half-width
NUC_R = 0.42


@dataclass
class Mesh:
    v: np.ndarray                       # (n,3)
    nrm: np.ndarray                     # (n,3)
    rgb: np.ndarray                     # (n,3) 0..1
    tri: np.ndarray                     # (m,3) int
    attr: dict = field(default_factory=dict)   # name -> (n,) float

    @property
    def n(self) -> int:
        return len(self.v)


def unit(a: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(a, axis=-1, keepdims=True)
    return a / np.where(n < 1e-12, 1.0, n)


def catmull(g: np.ndarray, samples: int) -> tuple[np.ndarray, np.ndarray]:
    """Centripetal-free uniform Catmull-Rom through guide points g (m,3) -> positions and tangents, (m-1)*samples+1 each."""
    m = len(g)
    p = np.vstack([g[:1], g, g[-1:]])
    pts, tans = [], []
    for i in range(m - 1):
        p0, p1, p2, p3 = p[i], p[i + 1], p[i + 2], p[i + 3]
        t = np.arange(samples)[:, None] / samples
        t2, t3 = t * t, t * t * t
        pts.append(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
        tans.append(0.5 * ((-p0 + p2) + 2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t + 3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t2))
    pts.append(g[-1:])
    tans.append((g[-1] - g[-2])[None, :])
    return np.vstack(pts), unit(np.vstack(tans))


def _smooth(c: np.ndarray, ss: list[str]) -> np.ndarray:
    """Guide points: Calpha for coil, a (1,2,1)/4 average inside helices and strands so the ribbon runs near the axis."""
    g = c.copy()
    for i in range(1, len(c) - 1):
        if ss[i] in "HE":
            g[i] = (c[i - 1] + 2 * c[i] + c[i + 1]) / 4
    return g


def _frames(seg: list[Residue], g: np.ndarray, tan_r: np.ndarray) -> np.ndarray:
    """One width direction per residue: radial for helices, the carbonyl direction for strands and coil, sign made consistent."""
    w = np.zeros((len(seg), 3))
    for i, r in enumerate(seg):
        if r.kind == "nucleic":
            w[i] = np.array([0.0, 1.0, 0.0])
        elif r.ss == "H":
            w[i] = r.ca - g[i]
        elif r.o is not None and r.c is not None:
            w[i] = r.o - r.c
        else:
            w[i] = np.array([0.0, 1.0, 0.0])
        w[i] = w[i] - np.dot(w[i], tan_r[i]) * tan_r[i]
        if np.linalg.norm(w[i]) < 1e-6:
            w[i] = np.cross(tan_r[i], np.array([0.0, 0.0, 1.0]))
            if np.linalg.norm(w[i]) < 1e-6:
                w[i] = np.cross(tan_r[i], np.array([0.0, 1.0, 0.0]))
        w[i] = unit(w[i])
        if i and np.dot(w[i], w[i - 1]) < 0:
            w[i] = -w[i]
    return w


def ribbon(seg: list[Residue], rgb_of, attr_of) -> Mesh:
    """Cartoon for one continuous segment (protein: coil tube, helix ribbon, strand arrow; nucleic: plain tube)."""
    m = len(seg)
    nucleic = seg[0].kind == "nucleic"
    ss = ["-"] * m if nucleic else [r.ss for r in seg]
    c = np.array([r.ca for r in seg])
    g = c.copy() if nucleic else _smooth(c, ss)
    pos, tan = catmull(g, SAMPLES)
    tan_r = tan[::SAMPLES]
    w_r = _frames(seg, g, tan_r)
    nr = len(pos)
    # residue index owning each ring and the blend between neighbours
    ring_res = np.minimum(np.round(np.arange(nr) / SAMPLES).astype(int), m - 1)
    f = np.arange(nr) / SAMPLES
    i0 = np.minimum(np.floor(f).astype(int), m - 1)
    i1 = np.minimum(i0 + 1, m - 1)
    t = f - i0
    w = unit(w_r[i0] * (1 - t)[:, None] + w_r[i1] * t[:, None])
    w = unit(w - np.sum(w * tan, axis=1, keepdims=True) * tan)
    nz = np.cross(tan, w)
    sm = np.clip((t - 0.35) / 0.30, 0, 1)
    sm = sm * sm * (3 - 2 * sm)
    sh = lambda k: np.array([(NUC_R, NUC_R, 2.0) if nucleic else SHAPE[ss[i]] for i in k])  # noqa: E731
    p0, p1 = sh(i0), sh(i1)
    par = p0 * (1 - sm)[:, None] + p1 * sm[:, None]
    a, b, e = par[:, 0].copy(), par[:, 1].copy(), par[:, 2]
    if not nucleic:   # arrow head on the last residue of every strand: widens at i-1, tapers to a point at i, then coil
        for i in range(m):
            if ss[i] == "E" and (i == m - 1 or ss[i + 1] != "E"):
                for rr in range(nr):
                    if i - 1 <= f[rr] < i:
                        u = f[rr] - (i - 1)
                        a[rr], b[rr], e[rr] = ARROW * (1 - u) + 0.15 * u, SHAPE["E"][1], SHAPE["E"][2]
                    elif i <= f[rr] <= i + 1:
                        a[rr], b[rr], e[rr] = SHAPE["-"]
    th = np.arange(RING) * 2 * np.pi / RING
    ct, st_ = np.cos(th), np.sin(th)
    ring_x = np.sign(ct)[None, :] * np.abs(ct)[None, :] ** (2.0 / e[:, None])
    ring_y = np.sign(st_)[None, :] * np.abs(st_)[None, :] ** (2.0 / e[:, None])
    v = (pos[:, None, :] + (a[:, None] * ring_x)[:, :, None] * w[:, None, :] + (b[:, None] * ring_y)[:, :, None] * nz[:, None, :])
    v = v.reshape(-1, 3)
    tri = []
    for r in range(nr - 1):
        base = r * RING
        for k in range(RING):
            k2 = (k + 1) % RING
            a0, a1, b0, b1 = base + k, base + k2, base + RING + k, base + RING + k2
            tri += [(a0, a1, b0), (a1, b1, b0)]       # wound so the face normal points out of the tube
    tri = np.array(tri, dtype=np.int64)
    # caps: copy the end rings and add a centre vertex so each cap gets its own flat normal
    extra_v, extra_t = [], []
    for ring_i, start in ((0, True), (nr - 1, False)):
        o = len(v) + len(extra_v)
        extra_v += [v[i] for i in range(ring_i * RING, ring_i * RING + RING)] + [pos[ring_i]]
        centre = o + RING
        for k in range(RING):
            k2 = (k + 1) % RING
            extra_t.append((o + k2, o + k, centre) if start else (o + k, o + k2, centre))
    ring_of_vert = np.concatenate([np.repeat(np.arange(nr), RING), np.repeat([0], RING + 1), np.repeat([nr - 1], RING + 1)])
    v_all = np.vstack([v, np.array(extra_v)])
    tri_all = np.vstack([tri, np.array(extra_t, dtype=np.int64)])
    nrm = vertex_normals(v_all, tri_all)
    res_of_vert = ring_res[ring_of_vert]
    rgb = np.array([rgb_of(seg[i]) for i in res_of_vert])
    attr = {k: np.array([fn(seg[i]) for i in res_of_vert], dtype=np.float64) for k, fn in attr_of.items()}
    return Mesh(v_all, nrm, rgb, tri_all, attr)


def vertex_normals(v: np.ndarray, tri: np.ndarray) -> np.ndarray:
    fn = np.cross(v[tri[:, 1]] - v[tri[:, 0]], v[tri[:, 2]] - v[tri[:, 0]])
    nrm = np.zeros_like(v)
    for k in range(3):
        np.add.at(nrm, tri[:, k], fn)
    return unit(nrm)


def sphere(centre: np.ndarray, radius: float, lat: int = 6, lon: int = 10) -> tuple[np.ndarray, np.ndarray]:
    vs = [centre + np.array([0, radius, 0])]
    for i in range(1, lat):
        phi = np.pi * i / lat
        for j in range(lon):
            th = 2 * np.pi * j / lon
            vs.append(centre + radius * np.array([np.sin(phi) * np.cos(th), np.cos(phi), np.sin(phi) * np.sin(th)]))
    vs.append(centre + np.array([0, -radius, 0]))
    vs = np.array(vs)
    tri = []
    for j in range(lon):
        tri.append((0, 1 + j, 1 + (j + 1) % lon))
    for i in range(lat - 2):
        for j in range(lon):
            a, b = 1 + i * lon + j, 1 + i * lon + (j + 1) % lon
            tri += [(a, a + lon, b), (b, a + lon, b + lon)]
    last = len(vs) - 1
    for j in range(lon):
        tri.append((last, 1 + (lat - 2) * lon + (j + 1) % lon, 1 + (lat - 2) * lon + j))
    return vs, np.array(tri, dtype=np.int64)


def prism(p: np.ndarray, q: np.ndarray, radius: float, sides: int = 6) -> tuple[np.ndarray, np.ndarray]:
    axis = unit(q - p)
    ref = np.array([0.0, 1.0, 0.0]) if abs(axis[1]) < 0.9 else np.array([1.0, 0.0, 0.0])
    u = unit(np.cross(axis, ref))
    w = np.cross(axis, u)
    th = np.arange(sides) * 2 * np.pi / sides
    ring = np.cos(th)[:, None] * u + np.sin(th)[:, None] * w
    vs = np.vstack([p + radius * ring, q + radius * ring])
    tri = []
    for k in range(sides):
        k2 = (k + 1) % sides
        tri += [(k, sides + k, k2), (k2, sides + k, sides + k2)]
    return vs, np.array(tri, dtype=np.int64)


def merge(parts: list[Mesh]) -> Mesh:
    parts = [p for p in parts if p.n]
    off = np.cumsum([0] + [p.n for p in parts])
    keys = sorted(set().union(*[set(p.attr) for p in parts]))
    return Mesh(np.vstack([p.v for p in parts]), np.vstack([p.nrm for p in parts]), np.vstack([p.rgb for p in parts]),
                np.vstack([p.tri + o for p, o in zip(parts, off)]),
                {k: np.concatenate([p.attr.get(k, np.full(p.n, -1.0)) for p in parts]) for k in keys})


def sticks(residues: list[Residue], rgb_of_atom, bond_r: float = 0.13, ball_r: float = 0.30) -> Mesh:
    """Ball-and-stick for the given residues, one merged mesh. Bonds are inferred within each residue by covalent radii."""
    vs, ns, cs, ts, ids = [], [], [], [], []
    off = 0
    for r in residues:
        at = r.atoms
        for ai, (nm, el, xyz) in enumerate(at):
            sv, st = sphere(xyz, ball_r)
            vs.append(sv); cs.append(np.tile(rgb_of_atom(el, nm), (len(sv), 1))); ts.append(st + off); ids.append(np.full(len(sv), r.index))
            ns.append(unit(sv - xyz)); off += len(sv)
            for bj in range(ai + 1, len(at)):
                nm2, el2, xyz2 = at[bj]
                d = np.linalg.norm(xyz - xyz2)
                if d < COVALENT.get(el, 0.8) + COVALENT.get(el2, 0.8) + 0.35 and d > 0.4:
                    mid = (xyz + xyz2) / 2
                    for p, q, e1 in ((xyz, mid, (nm, el)), (mid, xyz2, (nm2, el2))):
                        pv, pt = prism(p, q, bond_r)
                        ax = unit(q - p)
                        ref = pv - np.vstack([p + 0 * pv[:6], q + 0 * pv[6:]])
                        vs.append(pv); cs.append(np.tile(rgb_of_atom(*e1), (len(pv), 1))); ts.append(pt + off)
                        ids.append(np.full(len(pv), r.index)); ns.append(unit(ref - np.sum(ref * ax, axis=1, keepdims=True) * ax)); off += len(pv)
    if not vs:
        return Mesh(np.zeros((0, 3)), np.zeros((0, 3)), np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64))
    return Mesh(np.vstack(vs), np.vstack(ns), np.vstack(cs), np.vstack(ts), {"resid": np.concatenate(ids).astype(np.float64)})
