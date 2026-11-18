"""Task-fulfilment checker for the 50 prompts of the 17 Oct run (x3d.ML demo/live/prompts_live.jsonl).

Valid XML that draws is not a fulfilled request: a valid unrelated cube draws. This reads the structural constraints each
prompt carries (required_nodes, min_routes, min_use, min_transforms, min_defs, loop_false, min_joints, min_humanoids,
min_geolocations) and checks them on the scene. It is structural only: it does not check dimensions, ratios or what the
camera sees; a per-prompt behavioural check (for gears: ratio, direction, frames that change) is the next layer.
"""
from __future__ import annotations

from lxml import etree


def _ln(e):
    return etree.QName(e).localname if isinstance(e.tag, str) else None


def counts(xml: str) -> dict:
    root = etree.fromstring(xml.encode("utf-8"))
    tags = [_ln(e) for e in root.iter() if isinstance(e.tag, str)]
    c = {t: tags.count(t) for t in set(tags)}
    return {"tags": c, "nodes": len(tags), "use": sum(1 for e in root.iter() if isinstance(e.tag, str) and e.get("USE")),
            "defs": sum(1 for e in root.iter() if isinstance(e.tag, str) and e.get("DEF")),
            "loop_false": any(_ln(e) == "TimeSensor" and (e.get("loop") or "").lower() == "false" for e in root.iter() if isinstance(e.tag, str))}


def fulfilled(xml: str, cons: dict) -> tuple[bool, list[str]]:
    try:
        k = counts(xml)
    except etree.XMLSyntaxError:
        return False, ["unparseable"]
    t, miss = k["tags"], []
    for n in cons.get("required_nodes", []):
        if not t.get(n): miss.append(f"missing {n}")
    for key, have in (("min_routes", t.get("ROUTE", 0)), ("min_use", k["use"]), ("min_transforms", t.get("Transform", 0)),
                      ("min_defs", k["defs"]), ("min_joints", t.get("HAnimJoint", 0)), ("min_humanoids", t.get("HAnimHumanoid", 0)),
                      ("min_geolocations", t.get("GeoLocation", 0))):
        if key in cons and have < cons[key]: miss.append(f"{key} {have}<{cons[key]}")
    if cons.get("loop_false") and not k["loop_false"]: miss.append("no TimeSensor with loop=false")
    return not miss, miss
