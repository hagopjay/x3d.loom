"""Ladder v4 rungs, designed ONLY from design-half residuals (even prompt ids) of the 1,370 rerun scenes; scored on the test half (odd prompt ids). See v4_split_residual.py.
header : <X3D> version not in the schema's set (e.g. '4.10') -> '4.0'; missing profile -> 'Immersive'; Viewpoint@name -> description; blank Viewpoint@orientation dropped.
holders: a DEF'd Material-family or Appearance node written directly under <Scene> (schema: not allowed there) is wrapped in the standard definition holder
         <Switch whichChoice='-1'><Shape><Appearance>..</Appearance></Shape></Switch>, so later USE still resolves and nothing new is drawn.
Both are gate-checked by autofix_chain (kept only if the error count does not rise)."""
import re
from lxml import etree
def _ln(e): return etree.QName(e).localname if isinstance(e.tag, str) else None
VERS = {"3.0", "3.1", "3.2", "3.3", "4.0", "4.1"}
MAT = {"Material", "PhysicalMaterial", "UnlitMaterial", "TwoSidedMaterial"}
def fix_header(xml):
    ch = []
    m = re.search(r"<X3D\b[^>]*>", xml)
    if m:
        tag = m.group(0); t2 = tag
        v = re.search(r"\sversion=(['\"])([^'\"]*)\1", tag)
        if v and v.group(2) not in VERS and re.fullmatch(r"\d+\.\d+", v.group(2)): t2 = t2.replace(v.group(0), f" version={v.group(1)}4.0{v.group(1)}", 1); ch.append(f"X3D version {v.group(2)}->4.0")
        if not re.search(r"\sprofile=", t2): t2 = t2.replace("<X3D", "<X3D profile='Immersive'", 1); ch.append("X3D profile added")
        if t2 != tag: xml = xml.replace(tag, t2, 1)
    try: root = etree.fromstring(xml.encode("utf-8"))
    except etree.XMLSyntaxError: return xml, ch
    for e in root.iter("Viewpoint"):
        if "name" in e.attrib and "description" not in e.attrib: e.set("description", e.attrib.pop("name")); ch.append("Viewpoint@name->description")
        if "orientation" in e.attrib and not e.get("orientation").strip(): del e.attrib["orientation"]; ch.append("Viewpoint blank orientation dropped")
    return (etree.tostring(root, encoding="unicode") if any(c.startswith("Viewpoint") for c in ch) else xml), ch
def fix_holders(xml):
    try: root = etree.fromstring(xml.encode("utf-8"))
    except etree.XMLSyntaxError: return xml, []
    ch = []
    for sc in root.iter("Scene"):
        for c in list(sc):
            n = _ln(c)
            if n not in MAT and n != "Appearance": continue
            if not c.get("DEF"): continue
            i = sc.index(c); sw = etree.Element("Switch", whichChoice="-1"); sh = etree.SubElement(sw, "Shape")
            if n in MAT:
                ap = etree.SubElement(sh, "Appearance"); sc.remove(c); ap.append(c)
            else: sc.remove(c); sh.append(c)
            sc.insert(i, sw); ch.append(f"{n} DEF held in Switch")
    return (etree.tostring(root, encoding="unicode") if ch else xml), ch

GEOM_SIB = {"Box", "Sphere", "Cone", "Cylinder", "IndexedFaceSet", "IndexedLineSet", "ElevationGrid", "Extrusion", "Text", "PointSet", "LineSet", "IndexedTriangleSet", "TriangleSet", "IndexedQuadSet", "QuadSet", "Rectangle2D", "Disk2D", "Circle2D", "Arc2D"}
def fix_usetype(xml):
    """Found by University scale (21:06Z 17 Oct; flywheel/data/shape-use-case/): <Shape USE='AppX'/> where DEF='AppX' is an Appearance, with the geometry written as the
    following sibling(s). The validator only says 'Box not expected' and a containerField hint, and a writer following it ends invalid. Rewrite to
    <Shape><Appearance USE='AppX'/>{following geometry siblings}</Shape>. Gate-checked by the ladder like every rung."""
    try: root = etree.fromstring(xml.encode("utf-8"))
    except etree.XMLSyntaxError: return xml, []
    app_defs = {e.get("DEF") for e in root.iter() if _ln(e) == "Appearance" and e.get("DEF")}
    ch = []
    for sh in [e for e in root.iter() if _ln(e) == "Shape" and e.get("USE") in app_defs and len(e) == 0]:
        parent = sh.getparent()
        if parent is None: continue
        name = sh.get("USE"); i = parent.index(sh)
        sibs = []
        for nxt in list(parent)[i + 1:]:
            if _ln(nxt) in GEOM_SIB: sibs.append(nxt)
            else: break
        new = etree.Element("Shape"); app = etree.SubElement(new, "Appearance", USE=name)
        for s in sibs: parent.remove(s); new.append(s)
        parent.replace(sh, new); ch.append(f"Shape USE {name} -> Shape+Appearance USE+{len(sibs)} geometry")
    return (etree.tostring(root, encoding="unicode") if ch else xml), ch
