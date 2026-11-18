"""Deterministic repair ladder for validator-rejected scenes: (1) PBR names on Material, (2) fork containerField autofix, (3) declare the components the validator names.
Each rung is validator-gated: a rung's output is kept only if it does not increase the error count. No model calls."""
import re, sys, os
sys.path.insert(0, "."); import x3d_metric as M, autofix_pbr as A, autofix_v4 as V4
from lxml import etree
from validation.autofix import autofix_containerfields
COMP = re.compile(r"\((?:component) (\w+) level (\d+), not declared\)")
def add_components(xml, report_lines):
    need = {}
    for ln in report_lines:
        for name, lvl in COMP.findall(ln): need[name] = max(need.get(name, 0), int(lvl))
    if not need: return xml, []
    try: root = etree.fromstring(xml.encode("utf-8"))
    except Exception: return xml, []
    head = root.find("head")
    if head is None: head = etree.Element("head"); root.insert(0, head)
    have = {c.get("name"): int(c.get("level", 0)) for c in head if isinstance(c.tag, str) and etree.QName(c).localname == "component"}
    ch = []
    for name, lvl in need.items():
        if have.get(name, 0) >= lvl: continue
        for c in [c for c in head if isinstance(c.tag, str) and etree.QName(c).localname == "component" and c.get("name") == name]: head.remove(c)
        head.insert(0, etree.Element("component", name=name, level=str(lvl))); ch.append(f"component {name} {lvl}")
    return etree.tostring(root, encoding="unicode"), ch
ROOTERR = re.compile(r"No matching global declaration|attribute 'version'|The attribute 'version'")   # a root-level error hides deeper ones, so fixing it can raise the visible error count
def _has_root(k): return any(ROOTERR.search(e) for e in k["xsd_errors"])
def nerr(k): return len(k["xsd_errors"]) + len(k["sem_err_only"])
def ladder(xml, prune=None):
    """prune: add the last-resort attribute-deleting rung (default: env LADDER_PRUNE=1)."""
    prune = os.environ.get("LADDER_PRUNE") == "1" if prune is None else prune
    k = M.check(xml); log = []
    if k["valid"]: return xml, k, log
    v4 = os.environ.get("LADDER_V") == "4"   # v4 adds the header and holders rungs (designed on the design half only; see autofix_v4.py)
    rungs = ("pbr", "container", "component") if A.V1 else (("names", "header", "pbr", "syntax", "holders", "usetype", "container", "component") if v4 else ("names", "pbr", "syntax", "container", "component"))
    for rung in rungs + (("prune",) if prune and not A.V1 else ()):
        if rung == "pbr": cand, ch = A.fix(xml)
        elif rung == "syntax": cand, ch = A.fix_syntax(xml)
        elif rung == "names": cand, ch = A.fix_names(xml)
        elif rung == "header": cand, ch = V4.fix_header(xml)
        elif rung == "holders": cand, ch = V4.fix_holders(xml)
        elif rung == "usetype": cand, ch = V4.fix_usetype(xml)
        elif rung == "prune": cand, ch = A.fix_prune(xml, k["xsd_errors"] + k["sem_err_only"])
        elif rung == "container":
            r = autofix_containerfields(xml); cand, ch = r.get("fixed") or xml, [c.get("node", "?") for c in r.get("changes", [])]
        else: cand, ch = add_components(xml, k["sem_err_only"] + k["sem_errors"])
        if not ch: continue
        kk = M.check(cand)
        if nerr(kk) <= nerr(k) or (_has_root(k) and not _has_root(kk)): xml, k = cand, kk; log.append((rung, len(ch)))
        if k["valid"]: break
    return xml, k, log
