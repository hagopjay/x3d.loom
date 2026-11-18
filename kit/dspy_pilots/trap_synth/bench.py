"""Leave-one-out benchmark for rule synthesis: can a model turn an incident into a trap rule that is lawful on both sides?

Cases come from the Loom's own trap rules (loomkit.traps.RULES). For each rule the incident text is the rule's `origin`;
positives are real hits in the corpus plus mutants made from clean scenes (the mutator is the negative control, as in the
Loom's two-sided tests); negatives are scenes the shipped traps witness passes. Bases are split by path hash into three
groups so a proposer is scored on scenes it never saw. The oracle (loomkit.traps.check itself) must score 1.0.

Corpus roots default to sibling checkouts: LOOM_ROOT (x3d.loom) and MCP_ROOT (x3d_mcp), both read-only.
"""
from __future__ import annotations

import copy
import glob
import hashlib
import os
import random
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

KIT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(KIT))
from loomkit import traps  # noqa: E402

LOOM_ROOT = Path(os.environ.get("LOOM_ROOT", KIT.parent))
MCP_ROOT = Path(os.environ.get("MCP_ROOT", KIT.parent.parent / "x3d_mcp"))
MAX_BYTES = 60_000
SKIP = ("vendor", "node_modules", "x_ite", "/.git/")


def local(tag):
    return tag.rsplit("}", 1)[-1]


def els(root, tag):
    return [e for e in root.iter() if local(e.tag) == tag]


def _scene(root):
    s = els(root, "Scene")
    return s[0] if s else None


def _shape_with(tag, text="", **attrs):
    sh = ET.Element("Shape"); ap = ET.SubElement(sh, "Appearance")
    return sh, ET.SubElement(ap, tag, attrs)


# --- mutators: each returns the element it changed (or None when the base cannot take it) ---------------------------
def m_route_undefined(root, rnd):
    r = els(root, "ROUTE")
    if not r: return None
    r[0].set("toNode", "NoSuchNode"); return r[0]


def m_route_before_def(root, rnd):
    sc = _scene(root)
    for r in els(root, "ROUTE"):
        if sc is not None and r in list(sc):
            sc.remove(r); sc.insert(0, r); return r
    return None


def m_color_range(root, rnd):
    m = els(root, "Material")
    if not m: return None
    m[0].set("diffuseColor", "1.5 0.2 0.2"); return m[0]


def m_emissive_white(root, rnd):
    m = els(root, "Material")
    if not m: return None
    m[0].set("emissiveColor", "1 1 1"); m[0].set("diffuseColor", "1 0 0"); return m[0]


def m_splat_bbox(root, rnd):
    sc = _scene(root)
    if sc is None: return None
    e = ET.SubElement(sc, "GaussianSplats", {"url": '"a.splat"'}); return e


def m_movie_still(root, rnd):
    sc = _scene(root)
    if sc is None: return None
    sh, mt = _shape_with("MovieTexture", url='"poster.png"'); sc.append(sh); return mt


def m_version(root, rnd):
    sc = _scene(root)
    if sc is None: return None
    root.set("version", "4.0"); return ET.SubElement(sc, "InlineGeometry", {"url": '"a.x3d"'})


def m_metadata(root, rnd):
    sh = els(root, "Shape")
    if not sh: return None
    return ET.SubElement(sh[0], "MetadataString", {"name": "note", "value": '"x"'})


def m_glsl_active(root, rnd):
    sc = _scene(root)
    if sc is None: return None
    sh, cs = _shape_with("ComposedShader", language="GLSL")
    sp = ET.SubElement(cs, "ShaderPart", {"type": "FRAGMENT"}); sp.text = "uniform float active;\nvoid f(){}"
    sc.append(sh); return sp


def m_shader_raw(root, rnd):
    sc = _scene(root)
    if sc is None: return None
    sh, cs = _shape_with("ComposedShader", language="GLSL")
    sp = ET.SubElement(cs, "ShaderPart", {"type": "FRAGMENT"}); sp.text = "#version 300 es\nvoid main() { }"
    sc.append(sh); return sp


MUTATORS = {
    "route-undefined": m_route_undefined, "route-before-def": m_route_before_def, "color-range": m_color_range,
    "color-emissive-white": m_emissive_white, "splat-bbox": m_splat_bbox, "movie-not-still": m_movie_still,
    "version-fits-nodes": m_version, "metadata-containerfield": m_metadata, "glsl-reserved-active": m_glsl_active,
    "shader-raw-source": m_shader_raw,
}

# --- near-misses: the same edit, done lawfully. A rule that cannot tell these from the mutants has learned a keyword. ---
def n_route_undefined(root, rnd):
    r = els(root, "ROUTE")
    if not r: return None
    r[0].set("toNode", r[0].get("toNode")); return r[0]          # untouched: a ROUTE to a DEF that exists


def n_route_before_def(root, rnd):
    sc = _scene(root)
    for r in els(root, "ROUTE"):
        if sc is not None and r in list(sc):
            sc.remove(r); sc.append(r); return r                  # ROUTE moved to the end, after every DEF
    return None


def n_color_range(root, rnd):
    m = els(root, "Material")
    if not m: return None
    m[0].set("diffuseColor", "0.9 0.2 0.2"); return m[0]


def n_emissive_white(root, rnd):
    m = els(root, "Material")
    if not m: return None
    m[0].set("emissiveColor", "1 1 1"); m[0].set("diffuseColor", "1 1 1"); return m[0]   # white on white is fine


def n_splat_bbox(root, rnd):
    sc = _scene(root)
    if sc is None: return None
    return ET.SubElement(sc, "GaussianSplats", {"url": '"a.splat"', "bboxSize": "2 2 2", "bboxCenter": "0 0 0"})


def n_movie_still(root, rnd):
    sc = _scene(root)
    if sc is None: return None
    sh, mt = _shape_with("MovieTexture", url='"clip.mp4"'); sc.append(sh); return mt


def n_version(root, rnd):
    sc = _scene(root)
    if sc is None: return None
    root.set("version", "4.1"); return ET.SubElement(sc, "InlineGeometry", {"url": '"a.x3d"'})


def n_metadata(root, rnd):
    sh = els(root, "Shape")
    if not sh: return None
    return ET.SubElement(sh[0], "MetadataString", {"name": "note", "value": '"x"', "containerField": "metadata"})


def n_glsl_active(root, rnd):
    sc = _scene(root)
    if sc is None: return None
    sh, cs = _shape_with("ComposedShader", language="GLSL")
    sp = ET.SubElement(cs, "ShaderPart", {"type": "FRAGMENT"}); sp.text = "uniform float actives;\nvoid f(){}"
    sc.append(sh); return sp


def n_shader_raw(root, rnd):
    sc = _scene(root)
    if sc is None: return None
    sh, cs = _shape_with("ComposedShader", language="GLSL")
    sp = ET.SubElement(cs, "ShaderPart", {"type": "FRAGMENT"}); sp.text = "data:text/plain,#version 300 es\nvoid main() { }"
    sc.append(sh); return sp


NEAR = {"route-undefined": n_route_undefined, "route-before-def": n_route_before_def, "color-range": n_color_range,
        "color-emissive-white": n_emissive_white, "splat-bbox": n_splat_bbox, "movie-not-still": n_movie_still,
        "version-fits-nodes": n_version, "metadata-containerfield": n_metadata, "glsl-reserved-active": n_glsl_active,
        "shader-raw-source": n_shader_raw}
NATURAL_ONLY = ["loop-seam"]            # no mutator; real hits in the corpus are the positives
NOT_COVERED = {"color-keys-sparse": "needs a night-sky colour interpolator pair the mutators do not build",
               "xite-light-zero-pop": "needs a light fade through a ROUTE graph", "xite-transparent-shadow": "same",
               "no-script-under-host": "depends on a host profile, not on the file alone"}


def group(path: str) -> str:
    h = int(hashlib.sha1(path.encode()).hexdigest(), 16) % 10
    return "show" if h < 1 else "train" if h < 5 else "held"


def corpus():
    """Clean scenes (the shipped witness passes them) and natural hits, as (relpath, xml_text, hits)."""
    out = []
    for base in (LOOM_ROOT, MCP_ROOT):
        for f in sorted(glob.glob(str(base / "**/*.x3d"), recursive=True)):
            if any(s in f for s in SKIP): continue
            b = Path(f).read_bytes()
            if len(b) > MAX_BYTES: continue
            try:
                hits = traps.check(b)
            except Exception:  # noqa: BLE001
                continue
            out.append((os.path.relpath(f, base.parent), b.decode("utf-8", "replace"), [h.rule for h in hits]))
    return out


def _ser(el): return ET.tostring(el, encoding="unicode")


def build():
    cs = corpus()
    clean = [(p, x) for p, x, h in cs if not h]
    cases = {}
    for rid, rule in traps.RULES.items():
        if rid in NOT_COVERED: continue
        pos, twins = [], {}
        for p, x, h in cs:
            if rid in h: pos.append((p, x, "natural", None))
        if rid in MUTATORS:
            for p, x in clean:
                try: root = ET.fromstring(x)
                except ET.ParseError: continue
                el = MUTATORS[rid](root, random.Random(p))
                if el is None: continue
                mx = _ser(root)
                if rid in [h.rule for h in traps.check(mx.encode())]:        # the oracle must see the mutant
                    par = {c: pp for pp in root.iter() for c in pp}
                    ctx = _ser(par.get(el, el))[:700]
                    pos.append((p, mx, "mutant", ctx)); twins[p] = x
                    nroot = ET.fromstring(x)
                    if NEAR[rid](nroot, random.Random(p)) is not None:
                        nx = _ser(nroot)
                        if rid not in [h.rule for h in traps.check(nx.encode())]:
                            twins[p + " (near-miss)"] = nx
        if len(pos) < 6: continue
        c = {"rule": rid, "incident": rule.origin, "runtime": rule.runtime, "severity": rule.severity}
        for g in ("show", "train", "held"):
            c[f"pos_{g}"] = [(p, x, ctx) for p, x, k, ctx in pos if group(p) == g]
            c[f"neg_{g}"] = [(p, x) for p, x in clean if group(p) == g]
            c[f"twin_{g}"] = [(p, x) for p, x in twins.items() if group(p.split(' ')[0]) == g]
        if c["pos_held"] and c["pos_train"]:
            cases[rid] = c
    return cases


def run_rule(src, pos, neg, twin=(), runner=None):
    """score = recall on positives x specificity on clean scenes x specificity on the unmutated twins of the positives.
    The twin term closes a leak the first audit found: a rule that only asks 'does the file have a ROUTE?' passed
    because mutants came from route-bearing scenes and most clean scenes have none."""
    from sandbox import run
    runner = runner or run
    xs = [x for _, x, *_ in pos] + [x for _, x in neg] + [x for _, x in twin]
    res, err = runner(src, xs)
    a, b = len(pos), len(pos) + len(neg)
    rp, rn, rt = res[:a], res[a:b], res[b:]
    tpr = sum(1 for r in rp if r is True) / max(1, len(pos))
    tnr = sum(1 for r in rn if r is False) / max(1, len(neg))
    tnt = sum(1 for r in rt if r is False) / len(twin) if twin else 1.0
    fn = [pos[i][0] for i, r in enumerate(rp) if r is not True][:4]
    fp = [neg[i][0] for i, r in enumerate(rn) if r is not False][:4] + [twin[i][0] + ("" if "near-miss" in twin[i][0] else " (unmutated twin)") for i, r in enumerate(rt) if r is not False][:4]
    return {"tpr": round(tpr, 3), "tnr": round(tnr, 3), "tnr_twin": round(tnt, 3), "score": round(tpr * tnr * tnt, 3),
            "error": err, "missed": fn, "false_alarms": fp}


def oracle_rows(case, split):
    """The shipped witness, as the reference rule (must be 1.0): fires iff traps.check reports this rule."""
    rid = case["rule"]
    f = lambda x: rid in [h.rule for h in traps.check(x.encode())]  # noqa: E731
    pos, neg = case[f"pos_{split}"], case[f"neg_{split}"]
    tp = sum(f(x) for _, x, *_ in pos) / len(pos); tn = sum(not f(x) for _, x in neg) / len(neg)
    return {"tpr": tp, "tnr": tn, "score": tp * tn}


DEGENERATE = {
    "always-true": "def trap(root):\n    return True\n",
    "always-false": "def trap(root):\n    return False\n",
    "has-route": "def trap(root):\n    return any(e.tag.endswith('ROUTE') for e in root.iter())\n",
    "has-material": "def trap(root):\n    return any(e.tag.endswith('Material') for e in root.iter())\n",
    "big-scene": "def trap(root):\n    return len(list(root.iter())) > 60\n",
    "has-metadata": "def trap(root):\n    return any('Metadata' in e.tag for e in root.iter())\n",
}
