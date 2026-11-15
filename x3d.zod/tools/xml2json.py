#!/usr/bin/env python3
"""Schema-driven X3D XML -> X3D JSON (Web3D 4.0 JSON encoding) converter, for the zod corpus runs.

Field typing and container placement come from the (fixed) JSON Schema itself, so the output is
what the schema's own authors would call the encoding; anything the converter cannot place is
reported as `unplaced`, never silently dropped. Not a general-purpose exporter.
"""
import json, re, sys
from pathlib import Path
from lxml import etree

SCHEMA = Path(__file__).resolve().parent.parent / "schema" / "x3d-4.0-JSONSchema.json"
STR = re.compile(r'"((?:[^"\\]|\\.)*)"')


def load():
    s = json.loads(SCHEMA.read_text())
    n = s["$defs"].get("NavigationInfo", {})
    for v in n.get("oneOf", [n]):                    # the same in-memory fix as gen.mjs / x3d_mcp
        p = v.get("properties", {}).get("@type")
        if p and p.get("type") == "string" and p.get("$comment", "").startswith("MFString"):
            p["type"], p["items"] = "array", {"type": "string"}
    return s


S = load()
D = S["$defs"]


def res(n):
    while isinstance(n, dict) and "$ref" in n:
        n = D[n["$ref"].split("/")[-1]]
    return n


def variants(n):
    n = res(n)
    if "oneOf" in n or "anyOf" in n:
        out = []
        for a in n.get("oneOf", n.get("anyOf")):
            out += variants(a)
        return out
    return [n]


def props_of(n):
    """Merged properties of the non-USE variants of a node def (or plain object def)."""
    out = {}
    for v in variants(n):
        if v.get("type") == "array" and isinstance(v.get("items"), dict):
            out.update(props_of(v["items"]))
            continue
        if "@USE" in v.get("properties", {}) and "@DEF" not in v.get("properties", {}):
            continue
        out.update(v.get("properties", {}))
    return out


_acc = {}
def accepts(schema, name, depth=0):
    key = (id(schema), name)
    if key in _acc: return _acc[key]
    _acc[key] = False                                    # cycle guard
    r = False
    if depth < 6:
        for v in variants(schema):
            if name in v.get("properties", {}): r = True; break
            it = v.get("items")
            if isinstance(it, dict) and accepts(it, name, depth + 1): r = True; break
    _acc[key] = r
    return r


def is_array(schema):
    return any(v.get("type") == "array" for v in variants(schema))


def coerce(schema, text):
    vs = variants(schema)
    t = next((v.get("type") for v in vs if v.get("type")), "string")
    if t == "array":
        arr = next(v for v in vs if v.get("type") == "array")
        it = arr.get("items") or (arr.get("prefixItems") or [{}])[0]
        ivs = variants(it) if isinstance(it, dict) else [{}]
        it_t = next((v.get("type") for v in ivs if v.get("type")), "string")
        if it_t == "string":
            found = STR.findall(text)
            return [x.replace('\\"', '"').replace("\\\\", "\\") for x in found] if found else ([text] if text.strip() else [])
        parts = text.replace(",", " ").split()
        if it_t == "boolean": return [p.lower() == "true" for p in parts]
        if it_t == "integer": return [int(float(p)) for p in parts]
        return [num(p) for p in parts]
    if t == "boolean": return text.strip().lower() == "true"
    if t == "integer": return int(float(text))
    if t == "number": return num(text)
    return text


def num(p):
    f = float(p)
    return int(f) if f.is_integer() and abs(f) < 1e15 and "." not in p and "e" not in p.lower() else f


def convert_node(el, parent_def, unplaced):
    """Return the dict body for element `el` whose def is `parent_def` (already resolved by name)."""
    name = etree.QName(el).localname
    pdef = D.get(name, {})
    props = props_of(pdef)
    body = {}
    for k, v in el.attrib.items():
        k = etree.QName(k).localname if k.startswith("{") else k
        if k == "containerField" or k == "noNamespaceSchemaLocation": continue
        key = "@" + k
        if key in props:
            try: body[key] = coerce(props[key], v)
            except ValueError: body[key] = v
        else:
            body[key] = v; unplaced.append(f"{name}.{key}")
    text = (el.text or "").strip()
    if text:
        hk = next((p for p in props if p.startswith("#") and p != "#comment"), None)
        if hk: body[hk] = text.splitlines() if isinstance(props[hk], dict) and is_array(props[hk]) else text
    for c in el:
        if not isinstance(c.tag, str): continue
        cn = etree.QName(c).localname
        cb = convert_node(c, name, unplaced)
        cf = c.get("containerField")
        if cn in props and not cn.startswith(("-", "@")):
            place(body, cn, props[cn], cb, wrap=None)
        elif cf and ("-" + cf) in props:
            place(body, "-" + cf, props["-" + cf], cb, wrap=cn)
        else:
            tgt = next((p for p in props if p.startswith("-") and p != "-children" and accepts(props[p], cn)), None)
            if tgt: place(body, tgt, props[tgt], cb, wrap=cn)
            elif "-children" in props: place(body, "-children", props["-children"], cb, wrap=cn, force_array=True)
            else: unplaced.append(f"{name}>{cn}")
    return body


def place(body, key, schema, cb, wrap, force_array=False):
    val = cb if wrap is None else {wrap: cb}
    if force_array or is_array(schema):
        body.setdefault(key, []).append(val)
    else:
        body[key] = val


def xml_to_json(xml_bytes):
    root = etree.fromstring(xml_bytes, etree.XMLParser(huge_tree=True, remove_blank_text=True, resolve_entities=False, no_network=True))
    unplaced = []
    x = {"encoding": "UTF-8", "@profile": root.get("profile", "Full"), "@version": root.get("version", "4.0")}
    for c in root:
        if not isinstance(c.tag, str): continue
        cn = etree.QName(c).localname
        x[cn] = convert_node(c, "X3D", unplaced)
    return {"X3D": x}, unplaced


if __name__ == "__main__":
    doc, un = xml_to_json(Path(sys.argv[1]).read_bytes())
    json.dump(doc, sys.stdout, indent=1)
    print("unplaced:", un[:10], file=sys.stderr)
