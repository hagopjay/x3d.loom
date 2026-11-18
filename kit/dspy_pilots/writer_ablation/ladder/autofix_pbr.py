"""Candidate deterministic autofix for the top AI failure class: glTF/three.js PBR names on X3D's older Material.
Material(diffuseColor, roughness, metallic|metalness, ...) -> PhysicalMaterial(baseColor, roughness, metallic, ...) + Shape level 2 component.
Also GeoViewpoint@geoCoords -> position. Conservative: only touches nodes that already failed with a known class. Returns (fixed_xml, changes)."""
import os, re
from lxml import etree
V1 = os.environ.get("LADDER_V") == "1"   # v1 = the ladder behind the first published numbers (49/61, 51/61, 47/61); v3 (default) adds *Factor names, the syntax rung and the names rung
PBR_ATTRS = {"roughness", "metallic", "metalness"} if V1 else {"roughness", "metallic", "metalness", "roughnessFactor", "metallicFactor", "baseColorFactor", "emissiveFactor"}
FACTOR = {"roughnessFactor": "roughness", "metallicFactor": "metallic", "metalness": "metallic", "emissiveFactor": "emissiveColor"}   # glTF names -> PhysicalMaterial fields
DROP = {"shininess", "specularColor", "ambientIntensity"}          # not fields of PhysicalMaterial
def _ln(e): return etree.QName(e).localname if isinstance(e.tag, str) else None
def fix(xml):
    try: root = etree.fromstring(xml.encode("utf-8"))
    except etree.XMLSyntaxError: return xml, []
    ch, need_comp = [], False
    for e in root.iter():
        if _ln(e) == "Material" and PBR_ATTRS & set(e.attrib):
            ns = etree.QName(e).namespace; e.tag = etree.QName(ns, "PhysicalMaterial").text if ns else "PhysicalMaterial"
            if "diffuseColor" in e.attrib: e.set("baseColor", e.attrib.pop("diffuseColor"))
            for a, b in FACTOR.items():
                if a in e.attrib: e.set(b, e.attrib.pop(a))
            if "baseColorFactor" in e.attrib:                        # r g b a: colour to baseColor, alpha to transparency
                v = e.attrib.pop("baseColorFactor").replace(",", " ").split()
                if len(v) >= 3: e.set("baseColor", " ".join(v[:3]))
                if len(v) == 4 and "transparency" not in e.attrib:
                    try: e.set("transparency", f"{max(0.0, 1 - float(v[3])):g}")
                    except ValueError: pass
            for a in DROP & set(e.attrib): e.attrib.pop(a)
            ch.append("Material->PhysicalMaterial"); need_comp = True
        elif _ln(e) == "GeoViewpoint" and "geoCoords" in e.attrib:
            e.set("position", e.attrib.pop("geoCoords")); ch.append("GeoViewpoint@geoCoords->position")
    if need_comp and root.get("profile") != "Full":
        head = root.find("head")
        if head is None: head = etree.Element("head"); root.insert(0, head)
        if not any(_ln(c) == "component" and c.get("name") == "Shape" and int(c.get("level", 0)) >= 2 for c in head):
            c = etree.Element("component", name="Shape", level="2"); head.insert(0, c); ch.append("added <component Shape level 2>")
    return etree.tostring(root, encoding="unicode"), ch

HEAD_ORDER = {"component": 0, "unit": 1, "meta": 2}   # X3D 4.0 head content order
def fix_syntax(xml):
    """Second rung family: things models write that are plain syntax slips. head children out of order (meta before component), <title> in head,
    solid on Shape (belongs to the geometry node). Returns (fixed_xml, changes)."""
    try: root = etree.fromstring(xml.encode("utf-8"))
    except etree.XMLSyntaxError: return xml, []
    ch = []
    head = root.find("head")
    if head is not None:
        for t in [c for c in head if _ln(c) == "title"]:
            m = etree.Element("meta", name="title", content=(t.text or "").strip()); head.replace(t, m); ch.append("head/title -> meta")
        kids = list(head); srt = sorted(kids, key=lambda c: HEAD_ORDER.get(_ln(c), 3))
        if [id(k) for k in kids] != [id(k) for k in srt]:
            for k in kids: head.remove(k)
            for k in srt: head.append(k)
            ch.append("head order")
    for sh in root.iter("Shape"):
        if "solid" in sh.attrib:
            v = sh.attrib.pop("solid"); ch.append("Shape@solid removed")
            for g in sh:
                if _ln(g) in ("IndexedFaceSet", "Box", "Cone", "Cylinder", "Sphere", "ElevationGrid", "Extrusion", "IndexedTriangleSet", "TriangleSet") and "solid" not in g.attrib: g.set("solid", v); break
    return etree.tostring(root, encoding="unicode"), ch

RENAMES = {("Cone", "radius"): "bottomRadius", ("DirectionalLight", "castShadows"): "shadows", ("PointLight", "castShadows"): "shadows", ("SpotLight", "castShadows"): "shadows",
           ("Transform", "position"): "translation"}     # names models carry over from three.js/glTF/VRML habits; each target is the X3D 4.0 field with the same meaning
def fix_names(xml):
    """Third rung family (v3): spec-known renames, drop the default xmlns the schema rejects on <X3D>, add a missing/empty version. Returns (fixed_xml, changes)."""
    ch = []
    m = re.search(r"<X3D\b[^>]*>", xml)
    if m:
        tag = m.group(0); t2 = re.sub(r"\sxmlns=(['\"]).*?\1", "", tag)
        if t2 != tag: xml = xml.replace(tag, t2, 1); ch.append("X3D default xmlns removed"); tag = t2
        if not re.search(r"\sversion=(['\"])[0-9.]+\1", tag):
            t3 = re.sub(r"\sversion=(['\"])\1", "", tag).replace("<X3D", "<X3D version='4.0'", 1); xml = xml.replace(tag, t3, 1); ch.append("X3D version added")
    try: root = etree.fromstring(xml.encode("utf-8"))
    except etree.XMLSyntaxError: return xml, ch
    for e in root.iter():
        for (el, a), b in RENAMES.items():
            if _ln(e) == el and a in e.attrib and b not in e.attrib: e.set(b, e.attrib.pop(a)); ch.append(f"{el}@{a}->{b}")
    return (etree.tostring(root, encoding="unicode") if ch else xml), ch
ERR_ATTR = re.compile(r"Line (\d+): Element '(\w+)', attribute '(\w+)'")
def fix_prune(xml, errors):
    """LAST-RESORT rung, reported separately: delete attributes the schema says do not exist on that element. Viewers ignore unknown attributes, so the drawn scene
    does not change, but the author's intent is lost; a ladder that uses this rung must say so. Returns (fixed_xml, changes)."""
    todo = {(int(m.group(1)), m.group(2), m.group(3)) for e in errors for m in [ERR_ATTR.search(e)] if m}
    if not todo: return xml, []
    try: root = etree.fromstring(xml.encode("utf-8"))
    except etree.XMLSyntaxError: return xml, []
    ch = []
    for e in root.iter():
        for (ln_, el, a) in todo:
            if e.sourceline == ln_ and _ln(e) == el and a in e.attrib: del e.attrib[a]; ch.append(f"{el}@{a} pruned")
    return (etree.tostring(root, encoding="unicode") if ch else xml), ch
