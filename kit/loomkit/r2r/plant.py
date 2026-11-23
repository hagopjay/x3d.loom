"""Planting: make a new file that differs from a clean host by exactly one edit, so the edit can be blamed.

Every plant comes with its twin: the same host written out by the same serialiser with no edit. The oracle is asked
about both, so "the serialiser changed something" can never pass for "the plant changed something". Addresses are the
ones doc.El.path() gives (X3D/Scene[0]/Transform[2]), so a site found by the feature extractor can be edited here.
"""
from __future__ import annotations

import copy
import re
import sys
from xml.etree import ElementTree as ET

ET.register_namespace("xsd", "http://www.w3.org/2001/XMLSchema-instance")
HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n'
_STEP = re.compile(r"([^/\[]+)(?:\[(\d+)\])?")


def parse(data: bytes):
    try:
        return ET.fromstring(data)
    except (ET.ParseError, ValueError, LookupError, RecursionError):
        return None


def dump(root) -> bytes:
    limit = sys.getrecursionlimit()
    sys.setrecursionlimit(max(limit, 20000))        # ElementTree serialises recursively
    try:
        return (HEADER + ET.tostring(root, encoding="unicode")).encode("utf-8")
    finally:
        sys.setrecursionlimit(limit)


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def find(root, path: str):
    """The element at a doc.El.path() address, or None."""
    steps = path.split("/")
    if not steps or _local(root.tag) != steps[0]:
        return None
    el = root
    for step in steps[1:]:
        m = _STEP.fullmatch(step)
        if not m:
            return None
        tag, idx = m.group(1), int(m.group(2) or 0)
        same = [c for c in el if _local(c.tag) == tag]
        if idx >= len(same):
            return None
        el = same[idx]
    return el


def parent_of(root, el):
    for p in root.iter():
        for c in p:
            if c is el:
                return p
    return None


def twin(data: bytes) -> bytes | None:
    root = parse(data)
    return None if root is None else dump(root)


def set_attr(data: bytes, path: str, attr: str, value: str) -> bytes | None:
    root = parse(data)
    el = find(root, path) if root is not None else None
    if el is None:
        return None
    el.set(attr, value)
    return dump(root)


def del_attr(data: bytes, path: str, attr: str) -> bytes | None:
    root = parse(data)
    el = find(root, path) if root is not None else None
    if el is None or attr not in el.attrib:
        return None
    del el.attrib[attr]
    return dump(root)


def dup_elem(data: bytes, path: str) -> bytes | None:
    root = parse(data)
    el = find(root, path) if root is not None else None
    p = parent_of(root, el) if el is not None else None
    if p is None:
        return None
    clone = copy.deepcopy(el)
    clone.attrib.pop("DEF", None)                    # a second DEF would be a second fault
    p.insert(list(p).index(el) + 1, clone)
    return dump(root)


def del_elem(data: bytes, path: str) -> bytes | None:
    root = parse(data)
    el = find(root, path) if root is not None else None
    p = parent_of(root, el) if el is not None else None
    if p is None:
        return None
    p.remove(el)
    return dump(root)


def _scene_span(text: str) -> tuple[int, int] | None:
    m = re.search(r"<Scene(\s[^>]*)?>", text)
    end = text.rfind("</Scene>")
    if not m or end < 0 or m.group(0).endswith("/>"):
        return None
    return m.end(), end


def deepen(data: bytes, levels: int, tag: str = "Group") -> bytes | None:
    """Nest the scene's content `levels` deeper. Done on text: no parser has to survive the depth to write it."""
    base = twin(data)
    if base is None:
        return None
    text = base.decode("utf-8")
    span = _scene_span(text)
    if span is None:
        return None
    a, b = span
    return (text[:a] + f"<{tag}>" * levels + text[a:b] + f"</{tag}>" * levels + text[b:]).encode("utf-8")


def widen(data: bytes, count: int, tag: str = "Group") -> bytes | None:
    """Add `count` empty siblings at the end of the scene: more elements, no more depth."""
    base = twin(data)
    if base is None:
        return None
    text = base.decode("utf-8")
    span = _scene_span(text)
    if span is None:
        return None
    return (text[:span[1]] + f"<{tag}/>" * count + text[span[1]:]).encode("utf-8")


def pad(data: bytes, nbytes: int) -> bytes | None:
    """Add a comment of `nbytes` bytes at the end of the scene: a bigger file, nothing else."""
    base = twin(data)
    if base is None:
        return None
    text = base.decode("utf-8")
    span = _scene_span(text)
    if span is None:
        return None
    filler = "<!--" + "x" * max(0, nbytes - 7) + "-->"
    return (text[:span[1]] + filler + text[span[1]:]).encode("utf-8")


def rename_elem(data: bytes, path: str, new_tag: str, allowed_attrs=None) -> bytes | None:
    """Give an element another node type, keeping only the attributes the new type has (when told which those are)."""
    root = parse(data)
    el = find(root, path) if root is not None else None
    if el is None:
        return None
    el.tag = new_tag
    if allowed_attrs is not None:
        for a in list(el.attrib):
            if a not in allowed_attrs and a not in ("DEF", "USE", "containerField"):
                del el.attrib[a]
    return dump(root)


RECIPES = ("set_attr", "del_attr", "dup_elem", "del_elem", "rename_elem", "deepen", "widen", "pad")


def apply(host: bytes, recipe: list) -> bytes | None:
    """Build a probe again from its host and its recipe (probes.jsonl keeps both): first the host is written by this
    module's serialiser, as it was when the probe was made, then the one edit is applied."""
    op, args = recipe[0], list(recipe[1:])
    if op not in RECIPES:
        raise ValueError(f"not a plant recipe: {op!r}")
    base = twin(host)
    if base is None:
        return None
    if op == "rename_elem":
        from .uom import facts
        return rename_elem(base, args[0], args[1], set(facts().fields(args[1])))
    return globals()[op](base, *args)
