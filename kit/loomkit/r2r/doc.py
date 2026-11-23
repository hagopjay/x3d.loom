"""An X3D file as R2R reads it: elements in document order with parents, depths, the DEF table, the ROUTEs, and what
the raw bytes say before any parser runs (a DOCTYPE, entity declarations, a byte-order mark).

Built without recursion, so a file nested 100,000 deep is read like any other. A file that is not well-formed XML is
still a document here: it has no elements and says why, because "does not parse" is a fact a rule may need.
"""
from __future__ import annotations

import hashlib
import re
import xml.etree.ElementTree as ET

from . import uom

INDEX_REFERENT = {  # index attribute -> (container field of the child that is indexed, attribute holding the tuples)
    "coordIndex": ("coord", "point"), "index": ("coord", "point"), "colorIndex": ("color", "color"),
    "normalIndex": ("normal", "vector"), "texCoordIndex": ("texCoord", "point"),
}
TUPLE_OF = {"Coordinate": 3, "CoordinateDouble": 3, "GeoCoordinate": 3, "Color": 3, "ColorRGBA": 4, "Normal": 3,
            "TextureCoordinate": 2, "TextureCoordinate3D": 3, "TextureCoordinate4D": 4}
STRUCTURAL = {"X3D", "head", "Scene", "meta", "component", "unit", "ROUTE", "IMPORT", "EXPORT", "ProtoDeclare",
              "ProtoInterface", "ProtoBody", "ExternProtoDeclare", "field", "fieldValue", "IS", "connect"}


def local(name: str) -> str:
    return name.rsplit("}", 1)[-1]


class El:
    __slots__ = ("tag", "attrib", "text", "parent", "children", "depth", "order", "sib", "_cf", "_path")

    def __init__(self, tag, attrib, text, parent, depth, order):
        self.tag, self.attrib, self.text, self.parent, self.depth, self.order = tag, attrib, text, parent, depth, order
        self.children: list[El] = []
        self.sib = 0
        self._cf = None
        self._path = None

    def get(self, name, default=None):
        return self.attrib.get(name, default)

    def path(self) -> str:
        """An exact address: every ancestor with its position among same-named siblings (X3D/Scene[0]/Transform[2])."""
        if self._path is None:
            chain, e = [], self
            while e is not None and e._path is None:
                chain.append(e)
                e = e.parent
            prefix = e._path if e is not None else None
            for e in reversed(chain):
                e._path = e.tag if prefix is None else f"{prefix}/{e.tag}[{e.sib}]"
                prefix = e._path
        return self._path

    def where(self) -> str:
        """A short locator a person can find: up to three ancestors, with DEF names where there are any."""
        parts, e = [], self
        while e is not None and len(parts) < 4:
            d = e.attrib.get("DEF") or e.attrib.get("USE")
            parts.append(f"{e.tag}#{d}" if d else e.tag)
            e = e.parent
        return "/".join(reversed(parts))


class Doc:
    def __init__(self, data: bytes, name: str = ""):
        self.name = name
        self.bytes = len(data)
        self.sha256 = hashlib.sha256(data).hexdigest()
        self.facts = uom.facts()
        self.parse_error: str | None = None
        self._anc: dict[int, frozenset] = {}
        self._own: dict[int, frozenset] = {}
        self.elements: list[El] = []
        self.root: El | None = None
        head = data[:4096]
        self.bom = head.startswith((b"\xef\xbb\xbf", b"\xff\xfe", b"\xfe\xff"))
        self.has_doctype = b"<!DOCTYPE" in data[:65536]
        self.has_internal_subset = bool(re.search(rb"<!DOCTYPE[^>\[]*\[", data[:65536]))
        self.has_entity_decl = b"<!ENTITY" in data[:1 << 20]
        self.has_external_entity = bool(re.search(rb"<!ENTITY[^>]*\b(SYSTEM|PUBLIC)\b", data[:1 << 20]))
        m = re.search(rb"<\?xml[^>]*encoding=[\"']([A-Za-z0-9._\-]+)[\"']", head)
        self.encoding = m.group(1).decode("ascii", "replace").lower() if m else None
        try:
            root = ET.fromstring(data)
        except ET.ParseError as e:
            self.parse_error = str(e)[:200]
        except (ValueError, LookupError, RecursionError, MemoryError) as e:  # a NUL byte, an unknown encoding name
            self.parse_error = f"{type(e).__name__}: {e}"[:200]
        else:
            self._build(root)
        self.version = self.root.get("version", "") if self.root is not None else ""
        self.profile = self.root.get("profile", "") if self.root is not None else ""
        self.defs: dict[str, list[El]] = {}
        for e in self.elements:
            d = e.attrib.get("DEF")
            if d is not None:
                self.defs.setdefault(d, []).append(e)
        self.depth_max = max((e.depth for e in self.elements), default=0)

    def _build(self, root) -> None:
        stack = [(root, None, 1)]
        out = self.elements
        while stack:
            src, parent, depth = stack.pop()
            el = El(local(src.tag), {local(k): v for k, v in src.attrib.items()}, src.text or "", parent, depth, 0)
            if parent is None:
                self.root = el
            else:
                parent.children.append(el)
            out.append(el)
            kids = list(src)
            for k in reversed(kids):           # reversed, so the stack pops them in document order
                stack.append((k, el, depth + 1))
        for i, e in enumerate(out):
            e.order = i
            if e.children:
                seen: dict = {}
                for c in e.children:
                    c.sib = seen.get(c.tag, 0)
                    seen[c.tag] = c.sib + 1

    # --- relations ------------------------------------------------------------------------------------------------
    def ancestors(self, el: El) -> frozenset:
        """`anc:<Tag>` for every proper ancestor below X3D and Scene. Shared between siblings."""
        p = el.parent
        if p is None:
            return frozenset()
        cached = self._anc.get(id(p))
        if cached is None:
            up = self.ancestors(p) if p.depth < 400 else frozenset()
            cached = self._anc[id(p)] = up | ({"anc:" + p.tag} if p.tag not in ("X3D", "Scene") else set())
        return cached

    def owner_literals(self, el: El) -> frozenset:
        """`e.has:<attr>` and `e.child:<Tag>` of an element, for its attribute sites."""
        cached = self._own.get(id(el))
        if cached is None:
            cached = self._own[id(el)] = frozenset(["e.has:" + a for a in el.attrib] +
                                                   ["e.child:" + c.tag for c in el.children[:64]])
        return cached

    def first_def(self, name: str) -> El | None:
        v = self.defs.get(name)
        return v[0] if v else None

    def resolve(self, el: El) -> El:
        """The node a USE stands for, or the element itself."""
        u = el.attrib.get("USE")
        if u is None:
            return el
        return self.first_def(u) or el

    def container(self, el: El) -> str | None:
        """The parent field this element is filed under: its containerField, else the X3DUOM default for its type."""
        if el._cf is None:
            el._cf = el.attrib.get("containerField") or self.facts.default_container(el.tag) or ""
        return el._cf or None

    def referent_count(self, el: El, index_attr: str) -> int | None:
        """How many tuples the indexed child holds, or None when there is no such child or it cannot be counted."""
        ref = INDEX_REFERENT.get(index_attr)
        if not ref:
            return None
        field, _ = ref
        for c in el.children:
            if self.container(c) == field:
                target = self.resolve(c)
                size = TUPLE_OF.get(target.tag)
                attr = "vector" if target.tag == "Normal" else ("color" if target.tag in ("Color", "ColorRGBA") else "point")
                raw = target.attrib.get(attr)
                if size is None or raw is None:
                    return None
                return len([t for t in re.split(r"[\s,]+", raw.strip()) if t]) // size
        return None
