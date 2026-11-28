#!/usr/bin/env python3
"""Well-formedness + XSD validation of every .x3d in this folder. Writes xsd.json."""
import glob, json, os, sys
from lxml import etree
HERE = os.path.dirname(os.path.abspath(__file__))
XSD = os.path.join(HERE, "..", "kit", "xsd", "x3d-4.0.xsd")
schema = etree.XMLSchema(etree.parse(XSD))
out = {}
for f in sorted(glob.glob(os.path.join(HERE, "*.x3d"))):
    name = os.path.basename(f)
    try:
        tree = etree.parse(f, etree.XMLParser(load_dtd=False, no_network=True))
    except etree.XMLSyntaxError as e:
        out[name] = {"well_formed": False, "error": str(e)}
        continue
    ok = schema.validate(tree)
    out[name] = {"well_formed": True, "xsd_valid": ok, "errors": [str(e) for e in schema.error_log][:5]}
    print(name, "VALID" if ok else "INVALID", "" if ok else out[name]["errors"][:2])
json.dump(out, open(os.path.join(HERE, "xsd.json"), "w"), indent=1, sort_keys=True)
