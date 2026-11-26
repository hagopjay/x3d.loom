"""Two-sided check for x3d-glyphs: every USE resolves, blank glyphs add nothing, and the traps witness is silent on the
glyph scene but fires on the same scene written with Text. Run: python3 -I kit/x3d-glyphs/test_glyphs.py [font.ttf]"""
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE.parent))
from x3d_glyphs import GlyphText  # noqa: E402
from loomkit import traps  # noqa: E402

font = sys.argv[1] if len(sys.argv) > 1 else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
g = GlyphText({"R": font})
body = g.label("Hello, ARC", 0.5, (0.9, 0.8, 0.2), justify="MIDDLE") + g.label("a b", 1, (1, 1, 1))
scene = f"<X3D version='4.0'><Scene>{g.library_xml()}{body}</Scene></X3D>"
root = ET.fromstring(scene)
defs = {e.get("DEF") for e in root.iter() if e.get("DEF")}
uses = [e.get("USE") for e in root.iter() if e.get("USE")]
assert uses and all(u in defs for u in uses), "unresolved USE"
assert len(re.findall(r"<Transform translation", body)) >= 12, "label runs missing"
assert all(not h.rule == "text-needs-font-fetch" for h in traps.check(scene.encode(), {"host": "strict"})), "glyph scene fired the text rule"
text_scene = "<X3D version='4.0'><Scene><Shape><Text string='\"Hello\"'/></Shape></Scene></X3D>"
assert any(h.rule == "text-needs-font-fetch" for h in traps.check(text_scene.encode(), {"host": "strict"})), "Text scene did not fire"
print(f"x3d-glyphs ok: {len(defs)} DEFs, {len(uses)} USEs, library {len(g.library_xml())} bytes, font {Path(font).name}")
