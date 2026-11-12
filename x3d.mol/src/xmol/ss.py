"""Secondary structure: DSSP (pydssp 0.9.1, a numpy/torch port of the Kabsch-Sander rules) per continuous chain segment.

Three classes only: H (helix), E (strand), - (coil). The deposited HELIX/SHEET (or struct_conf) records are NOT used to
draw; they are the reference the agreement number in the receipt is measured against (grade C for the number, S for the drawing).
"""
from __future__ import annotations

import numpy as np

from .structure import Structure, segments


def assign(st: Structure) -> None:
    import pydssp
    for seg in segments(st.residues, "protein"):
        if len(seg) < 5:
            continue
        xyz = np.zeros((len(seg), 4, 3))
        for i, r in enumerate(seg):
            n = r.n if r.n is not None else r.ca
            c = r.c if r.c is not None else r.ca
            o = r.o if r.o is not None else c
            xyz[i] = (n, r.ca, c, o)
        codes = pydssp.assign(xyz, out_type="c3")
        for r, code in zip(seg, codes):
            r.ss = str(code) if str(code) in "HE" else "-"


def agreement(st: Structure) -> dict | None:
    """Residue-by-residue agreement with the deposited records, or None when the file has none."""
    if not st.deposited_ss:
        return None
    prot = [r for r in st.residues if r.kind == "protein"]
    same = tot = 0
    both = {"H": [0, 0], "E": [0, 0]}
    for r in prot:
        dep = st.deposited_ss.get((r.chain, r.num, r.icode), "-")
        tot += 1
        same += dep == r.ss
        for k in "HE":
            if dep == k:
                both[k][1] += 1
                both[k][0] += r.ss == k
    return {"residues": tot, "same": same, "fraction": round(same / tot, 4) if tot else None,
            "helix_recall": round(both["H"][0] / both["H"][1], 4) if both["H"][1] else None,
            "strand_recall": round(both["E"][0] / both["E"][1], 4) if both["E"][1] else None}
