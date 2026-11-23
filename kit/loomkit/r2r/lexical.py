"""How an X3D field value is written: tokens, type classes, and whether each token has the form its type requires.

The forms are the X3DUOM's own (FieldType/@regex): a float is `[+-]?digits[.digits][E[+-]digits]` with no leading zero,
a bool is `true` or `false`, an int may not be hexadecimal. `NaN`, `INF`, `--1`, `08` and `0x10` are therefore not
numbers in X3D, whatever a lenient reader makes of them. R2R keeps two readings side by side: the strict one (is this
legal?) and a lenient one (what number did the author probably mean?), because a failure receipt is usually about the
gap between them.
"""
from __future__ import annotations

import math
import re

FLOAT_RE = re.compile(r"[+-]?((0|[1-9][0-9]*)(\.[0-9]*)?|\.[0-9]+)([Ee][+-]?[0-9]+)?\Z")
INT_RE = re.compile(r"[+-]?(0|[1-9][0-9]*)([Ee][+-]?[0-9]+)?\Z")
HEX_RE = re.compile(r"[+-]?0[xX][0-9a-fA-F]+\Z")
LEADING_ZERO_RE = re.compile(r"[+-]?0[0-9]+(\.[0-9]*)?([Ee][+-]?[0-9]+)?\Z")
NCNAME_RE = re.compile(r"[A-Za-z_À-￿][A-Za-z0-9_.\-·À-￿]*\Z")
SPLIT_RE = re.compile(r"[\s,]+")
WORD_RE = re.compile(r"[A-Za-z_#][A-Za-z_0-9]*")
NONFINITE = {"nan": "nan", "+nan": "nan", "-nan": "nan", "inf": "inf", "+inf": "inf", "-inf": "inf",
             "infinity": "inf", "+infinity": "inf", "-infinity": "inf"}

FLOAT32_MAX = 3.4028234663852886e38
FLOAT32_MIN_NORMAL = 1.1754943508222875e-38
INT32_MAX, INT32_MIN = 2147483647, -2147483648

EXT_CLASS = {}
for _cls, _exts in {
    "image": "png jpg jpeg gif webp bmp tif tiff svg ktx ktx2 dds hdr exr avif",
    "video": "mp4 webm mov ogv m4v avi mkv mpg mpeg",
    "audio": "wav mp3 ogg oga flac aac m4a mid midi",
    "scene": "x3d x3dv wrl x3db x3dj json glb gltf usd usdz usda ply obj stl",
    "splat": "splat spz ksplat sog",
    "shader": "glsl vert frag vs fs wgsl",
    "script": "js mjs py class jar",
    "font": "ttf otf woff woff2",
}.items():
    for _e in _exts.split():
        EXT_CLASS[_e] = _cls


def type_class(ftype: str | None) -> str:
    """bool, int, float, string, mfstring, image, node or unknown."""
    if not ftype:
        return "unknown"
    base = ftype[2:]
    if base == "Bool":
        return "bool"
    if base == "Int32":
        return "int"
    if base == "String":
        return "mfstring" if ftype.startswith("MF") else "string"
    if base == "Image":
        return "image"
    if base == "Node":
        return "node"
    return "float"


def tokens(value: str) -> list[str]:
    """Whitespace- and comma-separated tokens, as every X3D numeric field is read."""
    return [t for t in SPLIT_RE.split(value.strip()) if t]


def mfstring(value: str) -> tuple[list[str], bool]:
    """The strings of an MFString and whether the quoting is balanced. A value with no quote is one string."""
    out, cur, inside, esc, saw_quote = [], [], False, False, False
    for ch in value:
        if esc:
            cur.append(ch); esc = False
        elif ch == "\\" and inside:
            esc = True
        elif ch == '"':
            saw_quote = True
            if inside:
                out.append("".join(cur)); cur = []
            inside = not inside
        elif inside:
            cur.append(ch)
    if not saw_quote:
        s = value.strip()
        return ([s] if s else []), True
    return out, not inside


def lenient_number(tok: str) -> tuple[float | None, str | None]:
    """(value, oddity). oddity is None for a legal X3D number, else nan, inf, hex, leading_zero or unparseable. A value is
    returned whenever Python can make one, because magnitude matters even when the spelling is wrong."""
    low = tok.lower()
    if low in NONFINITE:
        kind = NONFINITE[low]
        return (math.nan if kind == "nan" else (-math.inf if low.startswith("-") else math.inf)), kind
    if FLOAT_RE.match(tok):
        try:
            return float(tok), None
        except (ValueError, OverflowError):
            return None, "unparseable"
    if HEX_RE.match(tok):
        try:
            return float(int(tok, 16)), "hex"
        except ValueError:
            return None, "unparseable"
    if LEADING_ZERO_RE.match(tok):
        try:
            return float(tok), "leading_zero"
        except ValueError:
            return None, "unparseable"
    try:
        v = float(tok)
        return (v if math.isfinite(v) else None), "unparseable"
    except ValueError:
        return None, "unparseable"


def url_parts(s: str) -> tuple[str, str | None]:
    """(scheme, extension) of one URL string. scheme is 'none' for a relative path; extension is lower case, without
    query or fragment, or None."""
    s = s.strip()
    m = re.match(r"([A-Za-z][A-Za-z0-9+.\-]*):", s)
    scheme = m.group(1).lower() if m and len(m.group(1)) > 1 else "none"
    if scheme == "data":
        return scheme, None
    path = re.split(r"[?#]", s, maxsplit=1)[0]
    m = re.search(r"\.([A-Za-z0-9]{1,6})\Z", path)
    return scheme, (m.group(1).lower() if m else None)


def words(text: str, cap: int = 120) -> list[str]:
    """Identifier-like words of an element's text (shader or script source), first `cap` distinct, in order."""
    seen, out = set(), []
    for w in WORD_RE.findall(text):
        if w not in seen:
            seen.add(w); out.append(w)
            if len(out) >= cap:
                break
    return out
