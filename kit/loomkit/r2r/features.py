"""What R2R can say about a place in an X3D file: the rule vocabulary.

A document becomes a list of SITES. A site is one attribute, one element, or the document itself, and carries a set of
LITERALS (short strings such as `v:out_of_range`, `t:SFColor`, `n:Material`) plus a few NUMBERS (`depth_max`, `ntok`).
A rule is a set of literals, some negated, that must all hold at one site. That is the whole language; rule.py runs it.

The literals come in tiers, and the inducer prefers the lowest tier that explains a failure:

  tier 1  structural facts the X3DUOM lets a program check: the value does not have its type's form, a number is outside
          its declared range, an index points past the list it indexes, a USE has no DEF, a child is filed in a field its
          parent does not have, an SFNode field holds two nodes
  tier 2  the shape of a value: not finite, empty, all zero, larger than a float32 can hold; and thresholds on numbers
  tier 3  surface patterns: a URL's scheme and file type, a word in shader source
  tier 4  the literal value itself. A rule made only of these is a fingerprint, and is graded as one

Context literals (which node, which attribute, which field type, which parent, which X3D version) explain nothing by
themselves; they narrow where a test literal applies.

One function per site kind computes every literal, and rule matching reads the same sets, so induction and checking
cannot disagree about what a literal means.
"""
from __future__ import annotations

import math

from . import lexical as lx
from .doc import INDEX_REFERENT, STRUCTURAL, Doc, El
from .uom import XML_ATTRS

MAX_TOKENS = 20000      # tokens analysed per attribute; longer values are sampled and say so
EQ_MAX = 48             # longest value kept as a tier-4 literal
SINGLE_PRECISION = {"SFFloat", "MFFloat", "SFVec2f", "MFVec2f", "SFVec3f", "MFVec3f", "SFVec4f", "MFVec4f", "SFColor",
                    "MFColor", "SFColorRGBA", "MFColorRGBA", "SFRotation", "MFRotation", "SFMatrix3f", "MFMatrix3f",
                    "SFMatrix4f", "MFMatrix4f"}

# literal prefix (or whole literal) -> (tier, cost). The first match in this order wins.
COSTS = [
    ("v:eq:", 4, 5.0), ("v:tok:", 4, 4.5), ("tw:", 3, 3.2),
    ("v:ext:", 3, 3.3), ("v:extclass:", 3, 3.0), ("v:scheme:", 3, 3.0), ("tscheme:", 3, 3.0),
    ("v:nonascii", 3, 3.0), ("v:has_space", 3, 3.0), ("v:starts_digit", 3, 3.0),
    ("v:lexical_invalid", 1, 1.0), ("v:out_of_range", 1, 1.0), ("v:bool_noncanonical", 1, 1.1),
    ("v:number_unparseable", 1, 1.1), ("v:arity_mismatch", 1, 1.1), ("v:arity_short", 1, 1.2), ("v:arity_long", 1, 1.2),
    ("v:below_min", 1, 1.1), ("v:above_max", 1, 1.1), ("v:enum_violation", 1, 1.0), ("v:unknown_attr", 1, 1.0),
    ("v:use_undefined", 1, 1.0), ("v:use_before_def", 1, 1.0), ("v:use_type_mismatch", 1, 1.0),
    ("v:def_duplicate", 1, 1.0), ("v:id_lexical_invalid", 1, 1.0), ("v:route_node_undefined", 1, 1.0),
    ("v:route_node_forward", 1, 1.0), ("v:route_field_unknown", 1, 1.0), ("v:container_unknown", 1, 1.0),
    ("v:index_out_of_range", 1, 1.0), ("v:index_below_min", 1, 1.0), ("v:unbalanced_quote", 1, 1.0),
    ("x:sfnode_multiple", 1, 1.0), ("x:container_unknown", 1, 1.0), ("x:child_type_not_accepted", 1, 1.0),
    ("x:misfiled", 1, 1.0), ("x:unknown_node", 1, 1.0), ("x:node_newer_than_version", 1, 1.0),
    ("x:use_with_content", 1, 1.0), ("x:route_type_mismatch", 1, 1.0), ("x:not_wellformed", 1, 1.0),
    ("x:no_scene", 1, 1.0), ("x:root_not_x3d", 1, 1.0),
    ("ge:", 2, 2.2), ("le:", 2, 2.2),
    ("v:case_variant", 2, 1.8), ("v:present", 2, 2.6), ("v:", 2, 2.0), ("x:present", 2, 2.6), ("x:", 2, 2.0), ("text:", 2, 2.4), ("enc:", 2, 2.0),
    ("ntok:", 0, 0.6), ("nws:", 0, 0.6), ("has:", 0, 0.7), ("child:", 0, 0.7), ("cf:", 0, 0.7),
    ("at:", 0, 0.5), ("e.has:", 0, 0.8), ("e.child:", 0, 0.8), ("anc:", 0, 0.8),
    ("tc:", 0, 0.25), ("t:", 0, 0.3), ("isa:", 0, 0.4), ("n:", 0, 0.5), ("a:", 0, 0.5), ("p:", 0, 0.6),
    ("dv:", 0, 0.6), ("dp:", 0, 0.8), ("kind:", 0, 0.0),
]
CONTEXT_PREFIXES = ("n:", "a:", "t:", "tc:", "isa:", "p:", "dv:", "dp:", "kind:", "ntok:", "nws:", "has:", "child:", "cf:",
                    "at:", "e.has:", "e.child:", "anc:")


def tier(lit: str) -> int:
    lit = lit.lstrip("!")
    for prefix, t, _ in COSTS:
        if lit.startswith(prefix):
            return t
    return 2


def cost(lit: str) -> float:
    neg = lit.startswith("!")
    lit = lit.lstrip("!")
    for prefix, t, c in COSTS:
        if lit.startswith(prefix):
            # a negated context literal ("has no bboxSize") is a test; a negated test literal is only a guard
            return (c + 1.4 if t == 0 else c * 0.6) if neg else c
    return 2.0


def is_context(lit: str) -> bool:
    return lit.startswith(CONTEXT_PREFIXES)


def role(lit: str) -> str:
    """test: a literal that can be the reason a rule exists (any tier 1-4 literal, or the absence of an attribute or a
    child). context: a literal that only says where. guard: a negated literal that carves out an exception."""
    if lit.startswith("!"):
        return "test" if lit[1:].startswith(("has:", "child:")) else "guard"
    return "context" if is_context(lit) else "test"


def is_test(lit: str) -> bool:
    return role(lit) == "test"


class Site:
    __slots__ = ("kind", "el", "attr", "lits", "nums", "_where")

    def __init__(self, kind: str, el: El | None, attr: str | None, lits: set, nums: dict):
        self.kind, self.el, self.attr, self.nums = kind, el, attr, nums
        lits.add("kind:" + kind)
        self.lits = frozenset(lits)
        self._where = None

    @property
    def where(self) -> str:
        if self._where is None:
            if self.kind == "doc":
                self._where = "(document)"
            else:
                self._where = self.el.where() + (f"@{self.attr}" if self.attr else "")
        return self._where

    def key(self):
        """What makes two sites the same for a before/after comparison: the literals and the numbers."""
        return (self.lits, tuple(sorted(self.nums.items())))


def _ver(text: str) -> tuple:
    out = []
    for part in text.split(".")[:2]:
        try:
            out.append(int(part))
        except ValueError:
            return ()
    return tuple(out)


def _context(doc: Doc, el: El, lits: set) -> None:
    lits.add("n:" + el.tag)
    for a in doc.facts.isa(el.tag):
        lits.add("isa:" + a)
    lits.add("p:" + (el.parent.tag if el.parent is not None else "(none)"))
    lits.update(doc.ancestors(el))
    if doc.version:
        lits.add("dv:" + doc.version)


def _numeric(doc: Doc, el: El, attr: str, value: str, frow: dict, ftype: str, cls: str, lits: set, nums: dict) -> None:
    toks = lx.tokens(value)
    ntok = len(toks)
    nums["ntok"] = ntok
    lits.add("ntok:" + (str(ntok) if ntok <= 4 else "many"))
    if ntok == 0:
        lits.add("v:empty")
    sample = toks[:MAX_TOKENS]
    if ntok > MAX_TOKENS:
        lits.add("v:sampled")
    ft = doc.facts.field_types.get(ftype, {"tuple": 1, "array": ftype.startswith("MF")})
    tup, arr = ft["tuple"], ft["array"]
    bad_form = False
    if cls == "image":
        tup = 1
    elif arr:
        if ntok % tup:
            lits.update(("v:arity_mismatch", "v:arity_short" if ntok % tup < tup / 2 else "v:arity_long")); bad_form = True
    elif ntok != tup:
        lits.update(("v:arity_mismatch", "v:arity_short" if ntok < tup else "v:arity_long")); bad_form = True
    strict = lx.INT_RE if cls == "int" else lx.FLOAT_RE
    if any(t[:1] in "\"'" for t in sample[:64]):
        lits.add("v:quoted")
    vals: list[float] = []
    infinite = False
    for t in sample:
        v, odd = lx.lenient_number(t)
        if odd == "inf":
            infinite = True
        if odd is None and not strict.match(t):
            odd = "unparseable"                  # a float form where an integer is required
        if odd == "hex" and cls == "image":
            odd = None
        if odd is not None:
            bad_form = True
            if odd in ("nan", "inf"):
                lits.update(("v:nonfinite", "v:" + odd))
            elif odd == "hex":
                lits.add("v:hexlike")
            elif odd == "leading_zero":
                lits.add("v:leading_zero")
            else:
                lits.add("v:number_unparseable")
        if v is not None and math.isfinite(v):
            vals.append(v)
    if bad_form:
        lits.add("v:lexical_invalid")
    for t in dict.fromkeys(sample[:64]):
        if len(t) <= 16:
            lits.add("v:tok:" + t)
            if len([x for x in lits if x.startswith("v:tok:")]) >= 6:
                break
    if infinite:
        nums["max_abs"] = math.inf          # a magnitude threshold counts an infinity as past it
    if not vals:
        return
    lo, hi = min(vals), max(vals)
    nums["min"], nums["max"] = lo, hi
    nums["max_abs"] = math.inf if infinite else max(abs(lo), abs(hi))
    if lo < 0:
        lits.add("v:negative")
    whole = len(vals) == len(sample)       # every token was a finite number: "all" may be said of the value
    if whole and all(v == 0 for v in vals):
        lits.add("v:all_zero")
    elif any(v == 0 for v in vals):
        lits.add("v:any_zero")
    if len(sample) >= 2:
        lits.add("v:all_equal" if whole and lo == hi else "v:not_all_equal")
    if cls == "int" and (hi > lx.INT32_MAX or lo < lx.INT32_MIN):
        lits.add("v:int_overflow32")
    if ftype in SINGLE_PRECISION:
        if max(abs(lo), abs(hi)) > lx.FLOAT32_MAX:
            lits.add("v:float_overflow32")
        if any(0 < abs(v) < lx.FLOAT32_MIN_NORMAL for v in vals):
            lits.add("v:denormal32")
    # declared range
    below = above = False
    for key, test in (("min", lambda v, b: v < b), ("minx", lambda v, b: v <= b)):
        if key in frow:
            try:
                b = float(frow[key])
            except ValueError:
                continue
            if any(test(v, b) for v in vals):
                below = True
            if key == "min" and all(v == b for v in vals):
                lits.add("v:all_at_min")
    for key, test in (("max", lambda v, b: v > b), ("maxx", lambda v, b: v >= b)):
        if key in frow:
            try:
                b = float(frow[key])
            except ValueError:
                continue
            if any(test(v, b) for v in vals):
                above = True
            if key == "max" and all(v == b for v in vals):
                lits.add("v:all_at_max")
    if below:
        lits.update(("v:out_of_range", "v:below_min"))
    if above:
        lits.update(("v:out_of_range", "v:above_max"))
    if ftype in ("SFRotation", "MFRotation") and ntok % 4 == 0 and len(vals) == len(sample):
        if any(vals[i] == vals[i + 1] == vals[i + 2] == 0 for i in range(0, len(vals) - 3, 4)):
            lits.add("v:zero_axis")
    d = frow.get("d")
    if d is not None and not bad_form:
        dv = [lx.lenient_number(t)[0] for t in lx.tokens(d)]
        if len(dv) == len(vals) == ntok and all(a is not None and a == b for a, b in zip(dv, vals)):
            lits.add("v:is_default")
    # an index is judged against the list it points into
    if attr in INDEX_REFERENT and cls == "int":
        nums["index_max"] = hi
        if lo < -1:
            lits.add("v:index_below_min")
        count = doc.referent_count(el, attr)
        if count is not None:
            nums["index_excess"] = hi - count + 1
            if hi >= count:
                lits.add("v:index_out_of_range")


def _stringy(doc: Doc, el: El, attr: str, value: str, frow: dict | None, cls: str, lits: set, nums: dict) -> None:
    f = doc.facts
    nums["len"] = len(value)
    if cls == "mfstring":
        strings, balanced = lx.mfstring(value)
        nums["nstrings"] = len(strings)
        if not balanced:
            lits.update(("v:unbalanced_quote", "v:lexical_invalid"))
    else:
        strings = [value]
    if not value.strip():
        lits.add("v:empty")
    if any(ord(c) > 127 for c in value[:4096]):
        lits.add("v:nonascii")
    enum = f.enum(frow) if frow else None
    if enum is not None and strings and any(s not in enum for s in strings):
        lits.add("v:enum_violation")
        folded = {e.lower() for e in enum}
        if all(s in enum or s.lower() in folded for s in strings):
            lits.add("v:case_variant")
    if attr == "url" or attr.endswith("Url"):
        for s in strings[:8]:
            scheme, ext = lx.url_parts(s)
            lits.add("v:scheme:" + scheme)
            if ext:
                lits.add("v:ext:" + ext)
                lits.add("v:extclass:" + lx.EXT_CLASS.get(ext, "other"))
    bt = (frow or {}).get("bt", "")
    if attr == "DEF":
        if not lx.NCNAME_RE.match(value):
            lits.add("v:id_lexical_invalid")
        if len(doc.defs.get(value, ())) > 1:
            lits.add("v:def_duplicate")
    elif attr == "USE":
        target = doc.first_def(value)
        if target is None:
            lits.add("v:use_undefined")
        else:
            if target.order > el.order:
                lits.add("v:use_before_def")
            if target.tag != el.tag:
                lits.add("v:use_type_mismatch")
    elif el.tag == "ROUTE" and attr in ("fromNode", "toNode"):
        target = doc.first_def(value)
        if target is None:
            lits.add("v:route_node_undefined")
        elif target.order > el.order:
            lits.add("v:route_node_forward")
    elif el.tag == "ROUTE" and attr in ("fromField", "toField"):
        target = doc.first_def(el.attrib.get("fromNode" if attr == "fromField" else "toNode", ""))
        if target is not None and f.is_node(target.tag) and _route_field(f, target.tag, value) is None:
            lits.add("v:route_field_unknown")
    elif attr == "containerField":
        p = el.parent
        if p is not None and f.is_node(p.tag) and f.is_node(el.tag):
            row = f.field(p.tag, value)
            if row is None or row["t"] not in ("SFNode", "MFNode"):
                lits.add("v:container_unknown")
    elif bt in ("xs:NMTOKEN", "xs:ID", "xs:IDREF") or cls == "string":
        if cls == "string" and bt.startswith("xs:NM") and (" " in value.strip()):
            lits.add("v:has_space")
    if value[:1].isdigit() and attr in ("DEF", "USE", "name"):
        lits.add("v:starts_digit")
    if " " in value.strip() and attr in ("DEF", "USE"):
        lits.add("v:has_space")


def _route_field(f, node: str, name: str) -> dict | None:
    """The field a ROUTE names, allowing the set_ prefix and _changed suffix the standard permits."""
    fields = f.fields(node)
    for cand in (name, name[4:] if name.startswith("set_") else None, name[:-8] if name.endswith("_changed") else None,
                 "set_" + name, name + "_changed"):
        if cand and cand in fields:
            return fields[cand]
    return None


def attr_site(doc: Doc, el: El, attr: str, value: str) -> Site:
    lits: set = set()
    nums: dict = {}
    _context(doc, el, lits)
    lits.add("a:" + attr)
    lits.add(f"at:{el.tag}@{attr}")
    lits.add("v:present")
    lits.update(doc.owner_literals(el))       # what else the element holds: an importer often branches on it
    lits.discard("e.has:" + attr)
    lits.add("nws:" + (str(len(value.split())) if len(value.split()) <= 4 else "many"))
    if "," in value:
        lits.add("v:has_comma")
    f = doc.facts
    frow = f.field(el.tag, attr)
    ftype = frow["t"] if frow else None
    cls = lx.type_class(ftype)
    if frow is None:
        if f.known(el.tag) and attr not in XML_ATTRS and not attr.startswith("xml"):
            lits.add("v:unknown_attr")
    else:
        lits.add("t:" + ftype)
        lits.add("tc:" + cls)
    if cls == "bool":
        toks = lx.tokens(value)
        nums["ntok"] = len(toks)
        lits.add("ntok:" + (str(len(toks)) if len(toks) <= 4 else "many"))
        if not toks:
            lits.add("v:empty")
        if any(t[:1] in "\"'" for t in toks[:64]):
            lits.add("v:quoted")
        if any(t not in ("true", "false") for t in toks[:MAX_TOKENS]):
            lits.add("v:bool_noncanonical")
            if all(t.lower() in ("true", "false") for t in toks[:MAX_TOKENS]):
                lits.add("v:case_variant")
        if ftype == "SFBool" and len(toks) != 1:
            lits.update(("v:arity_mismatch", "v:arity_short" if not toks else "v:arity_long"))
        if "v:bool_noncanonical" in lits or "v:arity_mismatch" in lits:
            lits.add("v:lexical_invalid")
        for t in dict.fromkeys(toks[:6]):
            if len(t) <= 16:
                lits.add("v:tok:" + t)
        d = frow.get("d")
        if d is not None and value.strip() == d:
            lits.add("v:is_default")
    elif cls in ("int", "float", "image"):
        _numeric(doc, el, attr, value, frow, ftype, cls, lits, nums)
    else:
        _stringy(doc, el, attr, value, frow, cls, lits, nums)
    nums.setdefault("len", len(value))
    if len(value) <= EQ_MAX:
        lits.add("v:eq:" + value)
    return Site("attr", el, attr, lits, nums)


def elem_site(doc: Doc, el: El) -> Site:
    lits: set = set()
    f = doc.facts
    _context(doc, el, lits)
    lits.add("x:present")
    for a in el.attrib:
        lits.add("has:" + a)
    for c in el.children:
        lits.add("child:" + c.tag)
    if not el.children:
        lits.add("x:no_children")
    nums = {"nchildren": len(el.children), "depth": el.depth, "nattrs": len(el.attrib)}
    if "USE" in el.attrib:
        lits.add("x:is_use")
        if el.children or set(el.attrib) - {"USE", "containerField", "class", "id", "style"}:
            lits.add("x:use_with_content")
    if not f.known(el.tag):
        lits.add("x:unknown_node")
    elif f.since(el.tag) == "4.1" and doc.version and _ver(doc.version) and _ver(doc.version) < (4, 1):
        lits.add("x:node_newer_than_version")
    p = el.parent
    if p is not None and f.is_node(p.tag) and f.is_node(el.tag):
        cf = doc.container(el)
        lits.add("cf:" + (cf or "(none)"))
        row = f.field(p.tag, cf) if cf else None
        kind = doc.resolve(el).tag
        if row is None or row["t"] not in ("SFNode", "MFNode"):
            lits.update(("x:container_unknown", "x:misfiled"))
        else:
            if f.accepts(p.tag, cf, kind) is False:
                lits.update(("x:child_type_not_accepted", "x:misfiled"))
            if row["t"] == "SFNode":
                for sib in p.children:
                    if sib is el:
                        break
                    if f.is_node(sib.tag) and doc.container(sib) == cf:
                        lits.add("x:sfnode_multiple")
                        break
    if el.tag == "ROUTE":
        a = doc.first_def(el.attrib.get("fromNode", ""))
        b = doc.first_def(el.attrib.get("toNode", ""))
        if a is not None and b is not None and f.is_node(a.tag) and f.is_node(b.tag):
            fa = _route_field(f, a.tag, el.attrib.get("fromField", ""))
            fb = _route_field(f, b.tag, el.attrib.get("toField", ""))
            if fa and fb and fa["t"] != fb["t"]:
                lits.add("x:route_type_mismatch")
    text = el.text.strip() if el.text else ""
    if text and el.tag not in STRUCTURAL:
        lits.add("text:nonempty")
        nums["text_len"] = len(text)
        scheme, _ = lx.url_parts(text[:64])
        lits.add("tscheme:" + scheme)
        for w in lx.words(text[:20000], 60):
            lits.add("tw:" + w)
    return Site("elem", el, None, lits, nums)


def doc_site(doc: Doc) -> Site:
    lits: set = set()
    if doc.parse_error:
        lits.add("x:not_wellformed")
    if doc.version:
        lits.add("dv:" + doc.version)
    if doc.profile:
        lits.add("dp:" + doc.profile)
    for flag, name in ((doc.has_doctype, "x:has_doctype"), (doc.has_internal_subset, "x:has_internal_subset"),
                       (doc.has_entity_decl, "x:has_entity_decl"), (doc.has_external_entity, "x:has_external_entity"),
                       (doc.bom, "x:bom")):
        if flag:
            lits.add(name)
    if doc.encoding:
        lits.add("enc:" + doc.encoding)
    if doc.root is not None:
        if doc.root.tag != "X3D":
            lits.add("x:root_not_x3d")
        if not any(c.tag == "Scene" for c in doc.root.children):
            lits.add("x:no_scene")
    els = doc.elements
    nums = {"depth_max": doc.depth_max, "n_elements": len(els), "bytes": doc.bytes,
            "n_routes": sum(1 for e in els if e.tag == "ROUTE"), "n_defs": len(doc.defs),
            "max_attr_len": max((len(v) for e in els for v in e.attrib.values()), default=0),
            "max_nattrs": max((len(e.attrib) for e in els), default=0),
            "max_children": max((len(e.children) for e in els), default=0)}
    return Site("doc", None, None, lits, nums)


def sites(doc: Doc) -> list[Site]:
    out = [doc_site(doc)]
    for el in doc.elements:
        out.append(elem_site(doc, el))
        for a, v in el.attrib.items():
            out.append(attr_site(doc, el, a, v))
    return out


def bag(site_list: list[Site]) -> tuple[frozenset, dict]:
    """Every literal the document holds anywhere, and the largest of each number: enough to say quickly that a rule
    cannot fire, never enough to say that it does."""
    lits: set = set()
    nums: dict = {}
    for s in site_list:
        lits |= s.lits
        for k, v in s.nums.items():
            if k not in nums or v > nums[k]:
                nums[k] = v
    return frozenset(lits), nums


NUMBER_NAMES = {
    "depth_max": "the deepest nesting in the file", "n_elements": "the number of elements", "bytes": "the file size in bytes",
    "n_routes": "the number of ROUTEs", "n_defs": "the number of DEF names", "max_attr_len": "the longest attribute value",
    "max_nattrs": "the most attributes on one element", "max_children": "the most children of one element",
    "ntok": "the number of tokens", "len": "the length of the value", "max_abs": "the largest magnitude",
    "max": "the largest component", "min": "the smallest component", "index_max": "the largest index",
    "index_excess": "how far the largest index runs past the end of its list", "nchildren": "the number of children",
    "depth": "the nesting depth", "nattrs": "the number of attributes", "nstrings": "the number of strings",
    "text_len": "the length of the text",
}


def _threshold(arg: str, words: str) -> str:
    if ":" not in arg:
        return arg
    name, theta = arg.rsplit(":", 1)
    try:
        t = float(theta)
        theta = str(int(t)) if t == int(t) and abs(t) < 1e15 else f"{t:g}"
    except (ValueError, OverflowError):
        pass
    return f"{NUMBER_NAMES.get(name, name)} is {words} {theta}"


def describe(lit: str) -> str:
    """One literal in plain words, for the rule's sentence."""
    neg = lit.startswith("!")
    core = lit[1:] if neg else lit
    if neg and core.startswith("has:"):
        return f"it has no {core[4:]} attribute"
    if neg and core.startswith("child:"):
        return f"it has no {core[6:]} child"
    fixed = {
        "v:lexical_invalid": "the value does not have the written form its field type requires",
        "v:bool_noncanonical": "a boolean is spelt as something other than `true` or `false`",
        "v:number_unparseable": "a token is not a number in X3D's notation",
        "v:arity_mismatch": "the value has the wrong number of components for its field type",
        "v:arity_short": "the value has too few components for its field type",
        "v:arity_long": "the value has too many components for its field type",
        "v:out_of_range": "a component is outside the range the X3DUOM declares",
        "v:below_min": "a component is below the minimum the X3DUOM declares",
        "v:above_max": "a component is above the maximum the X3DUOM declares",
        "v:enum_violation": "the value is not in the field's closed list of choices",
        "v:unknown_attr": "the attribute is not a field of this node in the X3DUOM",
        "v:use_undefined": "a USE names a DEF that does not exist",
        "v:use_before_def": "a USE comes before its DEF",
        "v:use_type_mismatch": "a USE names a DEF of another node type",
        "v:def_duplicate": "the same DEF name is given twice",
        "v:id_lexical_invalid": "a DEF is not a legal XML name",
        "v:route_node_undefined": "a ROUTE names a node that has no DEF",
        "v:route_node_forward": "a ROUTE is written before the node it names",
        "v:route_field_unknown": "a ROUTE names a field its node does not have",
        "v:container_unknown": "containerField names a field the parent does not have",
        "v:index_out_of_range": "an index points past the end of the list it indexes",
        "v:index_below_min": "an index is below -1",
        "v:unbalanced_quote": "the quotes of an MFString do not pair up",
        "v:nonfinite": "a number is NaN or infinite", "v:nan": "a number is NaN", "v:inf": "a number is infinite",
        "v:empty": "the value is empty", "v:negative": "a component is negative", "v:all_zero": "every component is zero",
        "v:any_zero": "some component is zero", "v:all_equal": "all components are equal",
        "v:not_all_equal": "the components are not all equal", "v:all_at_max": "every component is at the field's maximum",
        "v:all_at_min": "every component is at the field's minimum", "v:int_overflow32": "an integer does not fit in 32 bits",
        "v:float_overflow32": "a number is larger than a 32-bit float can hold",
        "v:denormal32": "a number is smaller than a normal 32-bit float", "v:zero_axis": "a rotation has a zero-length axis",
        "v:is_default": "the value equals the field's default", "v:hexlike": "a number is written in hexadecimal",
        "v:leading_zero": "a number is written with a leading zero", "v:nonascii": "the value has non-ASCII characters",
        "v:has_space": "the value has a space inside", "v:starts_digit": "the value starts with a digit",
        "v:case_variant": "the value is a legal one written in another letter case",
        "v:quoted": "a token is wrapped in quotation marks where the field is not a string",
        "v:has_comma": "the value has a comma", "v:sampled": "the value is very long", "v:present": "the attribute is written", "x:present": "the node is present",
        "x:sfnode_multiple": "it is a second node in a field that holds one node",
        "x:container_unknown": "it is filed under a field its parent does not have",
        "x:child_type_not_accepted": "its parent's field does not accept this node type",
        "x:misfiled": "it is filed where its parent cannot hold it", "x:unknown_node": "the element is not an X3D node",
        "x:node_newer_than_version": "the node was added in a later X3D version than the file declares",
        "x:use_with_content": "a USE carries other content", "x:route_type_mismatch": "a ROUTE joins fields of two types",
        "x:not_wellformed": "the file is not well-formed XML", "x:no_scene": "the file has no Scene",
        "x:root_not_x3d": "the root element is not X3D", "x:is_use": "it is a USE", "x:no_children": "it has no children",
        "x:has_doctype": "the file has a DOCTYPE", "x:has_internal_subset": "the DOCTYPE carries its own declarations",
        "x:has_entity_decl": "the file declares XML entities", "x:has_external_entity": "the file declares an external entity",
        "x:bom": "the file starts with a byte-order mark", "text:nonempty": "the element has text content",
    }
    if core in fixed:
        text = fixed[core]
    else:
        head, _, arg = core.partition(":")
        if head == "v":
            head, _, arg = arg.partition(":")
            text = {"eq": f"the value is exactly `{arg}`", "tok": f"the value has the token `{arg}`",
                    "ext": f"a URL ends in .{arg}", "extclass": f"a URL points at {('an ' if arg[:1] in 'aeiou' else 'a ') + arg} file",
                    "scheme": f"a URL uses the scheme `{arg}`" if arg != "none" else "a URL is a plain path"}.get(head, core)
        else:
            text = {"n": f"the node is {arg}", "a": f"the attribute is {arg}", "t": f"the field type is {arg}",
                    "tc": f"the field holds a {arg}", "isa": f"the node is an {arg}", "p": f"the parent is {arg}",
                    "dv": f"the file declares X3D {arg}", "dp": f"the profile is {arg}", "has": f"it has the attribute {arg}",
                    "child": f"it has a {arg} child", "cf": f"it is filed under {arg}", "ntok": f"the value has {arg} token(s)",
                    "nws": f"the value has {arg} space-separated token(s)", "at": f"the place is {arg.replace('@', ' ')}",
                    "e.has": f"its element also has the attribute {arg}", "e.child": f"its element has a {arg} child",
                    "anc": f"it sits inside a {arg}",
                    "tw": f"its text has the word `{arg}`", "tscheme": (f"its text starts with the scheme `{arg}`" if arg != "none" else "its text is not a URL with a scheme"),
                    "enc": f"the declared encoding is {arg}", "kind": f"({arg} site)",
                    "ge": _threshold(arg, "at least"), "le": _threshold(arg, "at most")}.get(head, core)
    return ("NOT: " + text) if neg else text
