"""Science gates for x3d.STEM: case-manifest predicates for loom.scientific-case/1.

RECONSTRUCTED (grade L). The Scientific Loom's own "Loom governance patch" (sha256 5e0aac32..., 4 files,
8 tests per its evidence/patch.json) was not in the delivery. These predicates are rebuilt from its
docs/GATES.md and DEBRIEF.html, and from what the shipped tools/audit.py checks; when the original
patch arrives it should be compared against this file, not silently merged over it.

Differences from the shipped audit, on purpose:
- every predicate raises (need), so `python -O` cannot turn a red case green (loomkit law 18; the
  shipped audit gates on `assert` and exits 0 under -O with a corrupted payload, C 4 Nov);
- a witness whose `pass` flag disagrees with its own observed/limit is rejected as SCI_FALSE_GREEN;
- payloads are opened, not only hashed (PNG must end in IEND, JSON must parse): R26;
- the builder file named by builder_sha256 must be the shipped one: SCI_STALE_BUILDER; files the case lists
  under `dependencies` (paths inside the candidate, e.g. the solver module) must match too:
  SCI_STALE_DEPENDENCY (added 4 Nov for the Turing Garden; Kerr 2's profile named this gap);
- a deflated payload (`decoded_sha256`) must inflate to the recorded bytes: R26 for binary frames;
- the profile names required witnesses per kind (reference controls, invariants, refinement,
  degeneracy), so a case cannot pass by simply omitting the hard check.

Gate names follow GATES.md (SCI-MODEL-SCOPE, SCI-INVARIANTS, SCI-REFERENCE-CONTROL, SCI-REFINEMENT,
SCI-DEGENERACY, SCI-DISPLAY-RANGE, SCI-PUBLICATION, SCI-FAIL-CLOSED). Browser-side gates (frame
coherence, reconstruction, GPU location) stay with the project's browser witness.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import hashlib

from .core import GateError, need, sha256_file


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

CASE_SCHEMA = "loom.scientific-case/1"
RULES = {"at most": lambda o, l: o <= l, "at least": lambda o, l: o >= l}


def _finite(x) -> bool:
    return type(x) in (int, float) and math.isfinite(x)


def model_scope(case: dict) -> None:
    """SCI-MODEL-SCOPE: the equation, domain, units, parameters and stated limits are declared."""
    need(case.get("schema") == CASE_SCHEMA, "SCI_SCHEMA", str(case.get("schema")))
    for key in ("id", "kind", "equation"):
        need(isinstance(case.get(key), str) and case[key].strip(), "SCI_MODEL_SCOPE", key)
    dom = case.get("domain") or {}
    need(isinstance(dom.get("shape"), list) and dom["shape"] and all(type(n) is int and n > 0 for n in dom["shape"]),
         "SCI_MODEL_SCOPE", "domain.shape")
    need(isinstance(dom.get("units"), str) and dom["units"].strip(), "SCI_MODEL_SCOPE", "domain.units")
    need(isinstance(case.get("parameters"), dict) and case["parameters"], "SCI_MODEL_SCOPE", "parameters")
    need(isinstance(case.get("limits"), list) and any(isinstance(x, str) and len(x) > 20 for x in case["limits"]),
         "SCI_MODEL_SCOPE", "limits: at least one stated model limitation")


def witnesses(case: dict, required: list[str], min_count: int) -> list[dict]:
    """SCI-INVARIANTS / REFERENCE-CONTROL / REFINEMENT / DEGENERACY via the profile's required ids,
    plus internal consistency: a recorded pass must follow from observed vs limit."""
    ws = case.get("witnesses")
    need(isinstance(ws, list) and len(ws) >= min_count, "SCI_TOO_FEW_WITNESSES", f"{case.get('id')}: {len(ws or [])}")
    ids = [w.get("id") for w in ws]
    need(len(ids) == len(set(ids)), "SCI_DUPLICATE_WITNESS", case.get("id", ""))
    for req in required:
        need(any(isinstance(i, str) and req.lower() in i.lower() for i in ids), "SCI_REQUIRED_WITNESS_MISSING",
             f"{case.get('id')}: '{req}'")
    rows = []
    for w in ws:
        need(w.get("rule") in RULES, "SCI_WITNESS_RULE", f"{case.get('id')}: {w.get('id')}")
        need(_finite(w.get("observed")) and _finite(w.get("limit")), "SCI_WITNESS_NONFINITE", f"{case.get('id')}: {w.get('id')}")
        holds = RULES[w["rule"]](w["observed"], w["limit"])
        need(w.get("pass") is holds, "SCI_FALSE_GREEN" if w.get("pass") else "SCI_FALSE_RED", f"{case.get('id')}: {w['id']}")
        need(holds, "SCI_WITNESS_FAIL", f"{case.get('id')}: {w['id']} observed {w['observed']} {w['rule']} {w['limit']}")
        rows.append({"id": w["id"], "observed": w["observed"], "limit": w["limit"], "rule": w["rule"]})
    return rows


PNG_CHANNELS = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}
PNG_DEPTHS = {0: (1, 2, 4, 8, 16), 2: (8, 16), 3: (1, 2, 4, 8), 4: (8, 16), 6: (8, 16)}


def decode_png(data: bytes, max_pixels: int = 64 * 1024 * 1024) -> dict:
    """Decode a PNG far enough to know a viewer can (fourth review, 18 Nov 2026, defect 8: signature + IEND was called
    "decodable"; a 20-byte file with no IHDR or IDAT passed). Stdlib only, bounded: every chunk CRC, IHDR first with
    legal width/height/depth/colour/interlace, PLTE where colour type 3 needs it, at least one IDAT, IEND last; the
    IDAT stream inflated with a size cap to exactly the byte count IHDR implies, and every row filter byte in 0..4.
    It does not render colours or apply gamma; that is the eyes witness."""
    import struct, zlib
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("no PNG signature")
    pos, chunks = 8, []
    while pos < len(data):
        if pos + 12 > len(data):
            raise ValueError("truncated chunk")
        n, kind = struct.unpack(">I4s", data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + n]
        if len(body) != n or pos + 12 + n > len(data):
            raise ValueError(f"truncated {kind!r}")
        (crc,) = struct.unpack(">I", data[pos + 8 + n:pos + 12 + n])
        if zlib.crc32(kind + body) & 0xFFFFFFFF != crc:
            raise ValueError(f"bad CRC in {kind!r}")
        chunks.append((kind, body))
        pos += 12 + n
        if kind == b"IEND":
            break
    kinds = [k for k, _ in chunks]
    if not kinds or kinds[0] != b"IHDR" or len(chunks[0][1]) != 13:
        raise ValueError("IHDR must be the first chunk")
    if kinds[-1] != b"IEND" or pos != len(data):
        raise ValueError("IEND must be the last chunk")
    w, h, depth, ctype, comp, filt, inter = struct.unpack(">IIBBBBB", chunks[0][1])
    if not (0 < w < 2 ** 31 and 0 < h < 2 ** 31) or w * h > max_pixels:
        raise ValueError(f"size {w}x{h} out of bounds")
    if ctype not in PNG_DEPTHS or depth not in PNG_DEPTHS[ctype] or comp != 0 or filt != 0 or inter not in (0, 1):
        raise ValueError("illegal IHDR fields")
    if ctype == 3 and b"PLTE" not in kinds:
        raise ValueError("palette image without PLTE")
    idat = [b for k, b in chunks if k == b"IDAT"]
    if not idat:
        raise ValueError("no IDAT")
    bpp_bits = depth * PNG_CHANNELS[ctype]
    def rows(pw, ph):
        return [] if pw == 0 or ph == 0 else [(pw * bpp_bits + 7) // 8] * ph
    if inter == 0:
        layout = rows(w, h)
    else:   # Adam7: seven reduced images, each with its own rows
        layout = []
        for x0, y0, dx, dy in ((0, 0, 8, 8), (4, 0, 8, 8), (0, 4, 4, 8), (2, 0, 4, 4), (0, 2, 2, 4), (1, 0, 2, 2), (0, 1, 1, 2)):
            layout += rows((w - x0 + dx - 1) // dx, (h - y0 + dy - 1) // dy)
    want = sum(r + 1 for r in layout)
    d = zlib.decompressobj()
    try:
        raw = d.decompress(b"".join(idat), want + 1)
    except zlib.error as e:
        raise ValueError(f"IDAT does not inflate: {e}") from None
    if len(raw) != want or not d.eof:
        raise ValueError(f"IDAT inflates to {len(raw)} bytes{'' if d.eof else ' (stream incomplete)'}, IHDR implies {want}")
    at = 0
    for r in layout:
        if raw[at] > 4:
            raise ValueError(f"row filter {raw[at]} at byte {at}")
        at += r + 1
    return {"width": w, "height": h, "bit_depth": depth, "colour_type": ctype, "interlaced": bool(inter)}


def frames(case: dict, root: Path, evolving: bool, quant_limit: float) -> dict:
    """SCI-DISPLAY-RANGE and SCI-PUBLICATION: no clipping, bounded quantisation, increasing time,
    and every payload present, the declared size, the declared hash, and decodable."""
    fs = case.get("frames")
    need(isinstance(fs, list) and fs, "SCI_NO_FRAMES", case.get("id", ""))
    times = [f.get("time") for f in fs]
    need(all(_finite(t) for t in times), "SCI_TIME_NONFINITE", case.get("id", ""))
    if evolving:
        need(all(b > a for a, b in zip(times, times[1:])), "SCI_TIME_ORDER", case.get("id", ""))
    for f in fs:
        need(f.get("clipped_values", 0) == 0, "SCI_DISPLAY_CLIPPING", f"{case.get('id')}: {f.get('file')}")
        if "quantization_max" in f:
            need(_finite(f["quantization_max"]) and f["quantization_max"] <= quant_limit, "SCI_DISPLAY_QUANTIZATION",
                 f"{case.get('id')}: {f.get('file')} {f.get('quantization_max')}")
        for item in [f] + ([f["transfer"]] if isinstance(f.get("transfer"), dict) else []):
            p = root / item["file"]
            need(p.is_file(), "SCI_PAYLOAD_MISSING", item["file"])
            if "bytes" in item:
                need(p.stat().st_size == item["bytes"], "SCI_PAYLOAD_SIZE", item["file"])
            need(sha256_file(p) == item.get("sha256"), "SCI_PAYLOAD_HASH", item["file"])
            data = p.read_bytes()
            if p.suffix == ".png":
                try:
                    item_info = decode_png(data)
                except ValueError as e:
                    raise GateError("SCI_PUBLICATION_UNDECODABLE", f"{item['file']}: {e}") from None
                if "width" in item or "height" in item:
                    need((item.get("width"), item.get("height")) == (item_info["width"], item_info["height"]),
                         "SCI_PAYLOAD_SIZE", f"{item['file']}: declared {item.get('width')}x{item.get('height')}, decoded {item_info['width']}x{item_info['height']}")
            elif "decoded_sha256" in item:
                import zlib
                try:
                    raw = zlib.decompress(data)
                except zlib.error:
                    raise GateError("SCI_PUBLICATION_UNDECODABLE", item["file"]) from None
                need(sha256_bytes(raw) == item["decoded_sha256"], "SCI_PUBLICATION_UNDECODABLE", f"{item['file']}: decoded hash")
            elif p.suffix == ".json":
                try:
                    json.loads(data)
                except ValueError:
                    raise GateError("SCI_PUBLICATION_UNDECODABLE", item["file"]) from None
    return {"frames": len(fs), "first_time": times[0], "last_time": times[-1]}


def builder(case: dict, root: Path, builders: dict) -> str:
    """The case bank was produced by the builder that ships (builder_sha256 == sha256 of that file)."""
    rel = builders.get(case["kind"])
    need(rel, "SCI_BUILDER_UNKNOWN", case["kind"])
    p = root / rel
    need(p.is_file(), "SCI_BUILDER_MISSING", rel)
    need(sha256_file(p) == case.get("builder_sha256"), "SCI_STALE_BUILDER", f"{case['id']}: {rel}")
    deps = case.get("dependencies", {})
    need(isinstance(deps, dict), "SCI_STALE_DEPENDENCY", f"{case['id']}: dependencies must be a mapping")
    for dep, digest in deps.items():
        q = (root / dep).resolve()
        need(q.is_relative_to(root.resolve()) and q.is_file(), "SCI_STALE_DEPENDENCY", f"{case['id']}: {dep} missing or outside the candidate")
        need(sha256_file(q) == digest, "SCI_STALE_DEPENDENCY", f"{case['id']}: {dep}")
    return rel


def check_bank(root: Path, profile: dict) -> dict:
    """Run every gate over every case.json under root/cases. Raises on the first violation."""
    root = Path(root)
    sci = profile["science"]
    paths = sorted(root.glob(sci.get("case_glob", "cases/*/*/case.json")))
    need(len(paths) >= sci.get("min_cases", 1), "SCI_TOO_FEW_CASES", str(len(paths)))
    kinds_seen, rows = set(), []
    for p in paths:
        try:
            case = json.loads(p.read_text())
        except ValueError:
            raise GateError("SCI_MANIFEST_UNDECODABLE", str(p.relative_to(root))) from None
        model_scope(case)
        kind = case["kind"]
        need(kind in sci["kinds"], "SCI_KIND_NOT_IN_PROFILE", kind)
        k = sci["kinds"][kind]
        w = witnesses(case, k.get("required_witnesses", []), sci.get("min_witnesses", 3))
        fr = frames(case, root, k.get("evolving", False), sci.get("quantization_max", 1 / 510))
        b = builder(case, root, sci.get("builders", {}))
        kinds_seen.add(kind)
        rows.append({"case": case["id"], "witnesses": len(w), "builder": b, **fr})
    for kind in sci["kinds"]:
        need(kind in kinds_seen, "SCI_KIND_MISSING", kind)
    return {"cases": rows, "kinds": sorted(kinds_seen)}
