"""x3d-glyphs: text as geometry for X3D scenes that must draw labels without fetching a font.

Extracted from the A Landscape of Consciousness build (25 Nov 2026, LEARNINGS-landscape-of-consciousness.md, failure mode 408).
Usage:
    g = GlyphText({"R": "fonts/Ubuntu-R.ttf", "B": "fonts/Ubuntu-B.ttf"})
    xml = g.label("Panpsychism", size=0.5, color=(0.9, 0.8, 0.2), justify="MIDDLE")   # Transforms of <Shape USE>
    lib = g.library_xml()                                                              # write ONCE, before the first label
Requires fontTools, mapbox_earcut and numpy. The library Switch has whichChoice='-1': nothing in it draws; labels USE it.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glyphs import GlyphLib  # noqa: E402


def _f(x: float) -> str:
    s = f"{x:.4f}".rstrip("0").rstrip(".")
    return "0" if s in ("", "-0") else s


def _fv(c) -> str:
    return " ".join(_f(float(v)) for v in c)


class GlyphText:
    def __init__(self, fonts: dict[str, str]):
        self.fonts = {k: GlyphLib(p, k) for k, p in fonts.items()}
        self.inks: dict[str, str] = {}                 # colour string -> DEF name
        self.combos: dict[tuple, str] = {}             # (font key, char, ink) -> Shape DEF, in first-use order

    def _ink(self, color) -> str:
        key = _fv([min(1.0, max(0.0, float(v))) for v in color])
        return self.inks.setdefault(key, f"Ink{len(self.inks)}")

    def label(self, s: str, size: float, color, font: str = "R", justify: str = "BEGIN", dx: float = 0.0) -> str:
        lib, ink = self.fonts[font], self._ink(color)
        x = dx / size + (-lib.width(s) / 2 if justify == "MIDDLE" else 0.0)
        parts = []
        for ch in s:
            if lib.mesh(ch) is not None:
                name = f"S{font}{ord(ch)}_{ink}"
                self.combos.setdefault((font, ch, ink), name)
                parts.append(f"<Transform translation='{_f(x)} 0 0'><Shape USE='{name}'/></Transform>")
            x += lib.advance(ch)
        return f"<Transform translation='0 {_f(-0.34 * size)} 0' scale='{_f(size)} {_f(size)} {_f(size)}'>{''.join(parts)}</Transform>"

    @staticmethod
    def _drop_degenerate(pts, tris):
        """Drop triangles whose corners are collinear after the coordinates are rounded to the written precision (4 decimals): the
        x3d_mcp check mesh-zero-area-face found 31 such faces in the Landscape world (written at 3 decimals; this kit writes 4: 4 glyph meshes of its 118 warned before the filter, 0 after, Ubuntu R and B)."""
        r = [(round(float(x), 4), round(float(y), 4)) for x, y in pts]
        keep = []
        for a, b, c in tris:
            (ax, ay), (bx, by), (cx, cy) = r[a], r[b], r[c]
            if abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) > 1e-9:
                keep.append((a, b, c))
        return keep

    def library_xml(self, name: str = "GlyphLibrary") -> str:
        inv = {v: k for k, v in self.inks.items()}
        out, geos, apps = [f"<Switch DEF='{name}' whichChoice='-1'>"], set(), set()
        for (fk, ch, ink), sname in self.combos.items():
            pts, tris = self.fonts[fk].mesh(ch)
            tris = self._drop_degenerate(pts, tris)
            gname = f"G{fk}{ord(ch)}"
            app = (f"<Appearance USE='{ink}'/>" if ink in apps else
                   f"<Appearance DEF='{ink}'><UnlitMaterial emissiveColor='{inv[ink]}'/></Appearance>")
            apps.add(ink)
            if gname in geos:
                geo = f"<IndexedFaceSet USE='{gname}'/>"
            else:
                geos.add(gname)
                geo = (f"<IndexedFaceSet DEF='{gname}' solid='false' coordIndex='{' '.join(f'{a} {b} {c} -1' for a, b, c in tris)}'>"
                       f"<Coordinate point='{' '.join(f'{_f(x)} {_f(y)} 0' for x, y in pts)}'/></IndexedFaceSet>")
            out.append(f"<Shape DEF='{sname}'>{app}{geo}</Shape>")
        out.append("</Switch>")
        return "\n".join(out)
