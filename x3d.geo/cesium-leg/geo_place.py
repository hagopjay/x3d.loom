#!/usr/bin/env python3
"""Put an X3D scene on the WGS84 ellipsoid: wrap its Scene children in GeoLocation (Geospatial component, X3D 4.0).

  python3 geo_place.py IN.x3d OUT.x3d --at LAT LON H [--note TEXT]

geoSystem "GD" "WE": latitude and longitude in degrees, H in metres above the WGS84 ellipsoid (not above sea level).
The placed file is the single source of the placement: x3d_to_3dtiles.py reads geoCoords back from it.
"""
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

a = sys.argv
src, out = Path(a[1]), Path(a[2])
i = a.index("--at")
lat, lon, h = (float(x) for x in a[i + 1:i + 4])
note = a[a.index("--note") + 1] if "--note" in a else ""
tree = ET.parse(src)
root = tree.getroot()
root.set("profile", "Full")  # GeoLocation is Geospatial level 1, not in the Immersive profile
head = root.find("head")
comp = ET.Element("component", {"name": "Geospatial", "level": "1"})
head.insert(0, comp)
ET.SubElement(head, "meta", {"name": "geo:placement", "content": f"{lat} {lon} {h} (GD WE, ellipsoidal height) {note}".strip()})
scene = root.find("Scene")
keep = [c for c in scene if c.tag in ("WorldInfo", "NavigationInfo", "Background")]
move = [c for c in scene if c not in keep]
for c in move:
    scene.remove(c)
gl = ET.SubElement(scene, "GeoLocation", {"DEF": "GEO_PLACE", "geoSystem": '"GD" "WE"', "geoCoords": f"{lat!r} {lon!r} {h!r}"})
for c in move:
    if c.tag != "Viewpoint":
        gl.append(c)
ET.indent(root)
out.write_text('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 4.0//EN" '
               '"https://www.web3d.org/specifications/x3d-4.0.dtd">\n' + ET.tostring(root, encoding="unicode") + "\n")
print({"geoCoords": [lat, lon, h], "children_moved": len([c for c in move if c.tag != "Viewpoint"])})
