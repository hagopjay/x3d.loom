"""Read a PDB or mmCIF file into plain arrays, model 1 only.

gemmi does the parsing. The witness (witness.py) deliberately does NOT use this module: it has its own line
parser, so a parsing bug here cannot also hide there.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path

import gemmi
import numpy as np

COVALENT = {"H": 0.31, "C": 0.76, "N": 0.71, "O": 0.66, "S": 1.05, "P": 1.07, "SE": 1.20, "ZN": 1.22}


@dataclass
class Residue:
    chain: str
    name: str
    num: int
    icode: str
    kind: str                      # "protein" | "nucleic"
    ca: np.ndarray | None          # the guide atom: CA for protein, C4' for nucleic
    o: np.ndarray | None           # carbonyl O (protein)
    c: np.ndarray | None
    n: np.ndarray | None
    b: float                       # mean B-factor of the residue's atoms (pLDDT for AlphaFold models)
    atoms: list = field(default_factory=list)   # (name, element, xyz ndarray)
    ss: str = "-"                  # "H" | "E" | "-"
    index: int = -1                # position in Structure.residues

    @property
    def label(self) -> str:
        return f"{self.name}{self.num}{self.icode}"


@dataclass
class Metal:
    chain: str
    name: str
    num: int
    element: str
    xyz: np.ndarray


@dataclass
class Structure:
    id: str
    source_file: str
    source_sha256: str
    confidence: bool                      # True when B holds pLDDT (AlphaFold models)
    residues: list[Residue]
    metals: list[Metal]
    chains: list[str]
    deposited_ss: dict                    # (chain, num, icode) -> "H"/"E"  from HELIX/SHEET or struct_conf
    n_models: int
    title: str = ""


def sha256_file(path: Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def _first(res: gemmi.Residue, name: str):
    a = res.find_atom(name, "*")
    return None if a is None else a


def _xyz(a) -> np.ndarray:
    return np.array([a.pos.x, a.pos.y, a.pos.z], dtype=np.float64)


def read(path: str | Path, ident: str, confidence: bool = False) -> Structure:
    path = Path(path)
    st = gemmi.read_structure(str(path))
    st.setup_entities()
    model = st[0]
    residues: list[Residue] = []
    metals: list[Metal] = []
    chains: list[str] = []
    for ch in model:
        for res in ch:
            info = gemmi.find_tabulated_residue(res.name)
            is_aa = bool(info and info.is_amino_acid())
            is_na = bool(info and info.is_nucleic_acid())
            if res.het_flag == "H" and not (is_aa or is_na):
                for a in res:
                    if a.element.name.upper() == "ZN" and a.altloc in ("\0", " ", "A"):
                        metals.append(Metal(ch.name, res.name, res.seqid.num, "Zn", _xyz(a)))
                continue
            if not (is_aa or is_na):
                continue
            guide = _first(res, "CA" if is_aa else "C4'")
            if guide is None:
                continue
            atoms = []
            bs = []
            seen = set()
            for a in res:
                if a.altloc not in ("\0", " ", "A") or a.element.name.upper() in ("H", "D"):
                    continue
                seen.add(a.name)
                atoms.append((a.name, a.element.name.upper(), _xyz(a)))
                bs.append(a.b_iso)
            o, c, n = (_first(res, x) for x in ("O", "C", "N"))
            r = Residue(ch.name, res.name, res.seqid.num, (res.seqid.icode or "").strip(), "protein" if is_aa else "nucleic",
                        _xyz(guide), None if o is None else _xyz(o), None if c is None else _xyz(c),
                        None if n is None else _xyz(n), float(np.mean(bs)), atoms)
            r.index = len(residues)
            residues.append(r)
            if ch.name not in chains:
                chains.append(ch.name)
    dep: dict = {}
    for h in st.helices:
        _span(model, h.start, h.end, "H", dep)
    for sh in st.sheets:
        for s in sh.strands:
            _span(model, s.start, s.end, "E", dep)
    return Structure(ident, path.name, sha256_file(path), confidence, residues, metals, chains, dep, len(st), st.name or ident)


def _span(model, start, end, code: str, out: dict) -> None:
    ch = model.find_chain(start.chain_name)
    if ch is None:
        return
    inside = False
    for res in ch:
        sid = res.seqid
        if (sid.num, (sid.icode or "").strip()) == (start.res_id.seqid.num, (start.res_id.seqid.icode or "").strip()):
            inside = True
        if inside:
            out[(ch.name, sid.num, (sid.icode or "").strip())] = code
        if (sid.num, (sid.icode or "").strip()) == (end.res_id.seqid.num, (end.res_id.seqid.icode or "").strip()):
            break


def segments(residues: list[Residue], kind: str, max_gap: float = 4.5) -> list[list[Residue]]:
    """Runs of one chain and one kind whose guide atoms are close enough to be bonded neighbours."""
    out: list[list[Residue]] = []
    cur: list[Residue] = []
    for r in residues:
        if r.kind != kind:
            continue
        if cur and (cur[-1].chain != r.chain or np.linalg.norm(cur[-1].ca - r.ca) > (max_gap if kind == "protein" else 9.0)):
            out.append(cur)
            cur = []
        cur.append(r)
    if cur:
        out.append(cur)
    return out
