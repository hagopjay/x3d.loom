"""Numbers to named buckets, computed in code (vendor jaggedness failure mode 2: given RGB triples or hex values the model
cannot reliably judge whether two values are near each other; names and buckets do better). X3D is mostly numbers, so the
rule matters more here than almost anywhere: convert first, ask about the bucket."""
from __future__ import annotations

import colorsys
from typing import Sequence


def bucket(value: float, edges: Sequence[float], names: Sequence[str]) -> str:
    """names has len(edges)+1 entries; value < edges[0] -> names[0], ..."""
    if len(names) != len(edges) + 1:
        raise ValueError("names must be one longer than edges")
    for e, n in zip(edges, names):
        if value < e:
            return n
    return names[-1]


_HUES = [(15, "red"), (45, "orange"), (70, "yellow"), (160, "green"), (200, "cyan"), (255, "blue"), (290, "purple"), (335, "magenta"), (361, "red")]


def color_name(r: float, g: float, b: float) -> str:
    """X3D SFColor components are 0..1. Returns names such as 'black', 'white', 'grey', 'dark blue', 'light orange'."""
    r, g, b = (min(1.0, max(0.0, float(x))) for x in (r, g, b))
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    if v < 0.10:
        return "black"
    if s < 0.12:
        return "white" if v > 0.9 else ("light grey" if v > 0.65 else ("grey" if v > 0.35 else "dark grey"))
    hue = h * 360.0
    name = next(n for lim, n in _HUES if hue < lim)
    if v < 0.4:
        return f"dark {name}"
    if v > 0.85 and s < 0.45:
        return f"light {name}"
    return name


def count_bucket(n: int) -> str:
    return bucket(n, (1, 2, 4, 9, 33, 129), ("none", "one", "a pair", "a few", "several", "many", "dozens"))


def size_bucket(elements: int) -> str:
    """Scene size by element count (code decides; a judge never counts)."""
    return bucket(elements, (50, 500, 5000, 50000), ("tiny", "small", "medium", "large", "huge"))
