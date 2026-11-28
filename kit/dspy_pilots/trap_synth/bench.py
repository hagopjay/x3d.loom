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


# --- mutators ---------------------------------------------------------------------------------------------------------
# Each mutator is f(root, lawful) -> element or None. lawful=False plants the trap; lawful=True makes the same structural
# edit correctly (the near-miss). A rule has a DEV mutator (used for show and train) and SEALED variants that only the
# held-out split sees, so a rule that memorised the dev mutation's exact literal loses on held-out (external review, 18 Nov).
def _mat(root):
    m = els(root, "Material")
    return m[0] if m else None


def _add_shape(root, tag, **attrs):
    sc = _scene(root)
    if sc is None: return None
    sh, el = _shape_with(tag, **attrs); sc.append(sh); return el


def _shader(root, text):
    sc = _scene(root)
    if sc is None: return None
    sh, cs = _shape_with("ComposedShader", language="GLSL")
    sp = ET.SubElement(cs, "ShaderPart", {"type": "FRAGMENT"}); sp.text = text; sc.append(sh); return sp


def route_undefined(root, lawful, end="toNode"):
    r = els(root, "ROUTE")
    if not r: return None
    if not lawful: r[0].set(end, "NoSuchNode")
    return r[0]


def route_before_def(root, lawful, pos=0):
    sc = _scene(root)
    for r in els(root, "ROUTE"):
        if sc is not None and r in list(sc):
            sc.remove(r); sc.insert(pos if not lawful else len(list(sc)), r); return r
    return None


def color(root, lawful, val="1.5 0.2 0.2", ok="0.9 0.2 0.2", attr="diffuseColor"):
    m = _mat(root)
    if m is None: return None
    m.set(attr, ok if lawful else val); return m


def color_pbr(root, lawful):
    return _add_shape(root, "PhysicalMaterial", baseColor="0.9 0.2 0.2" if lawful else "1.2 0.2 0.2")


def emissive_white(root, lawful, diffuse="1 0 0"):
    m = _mat(root)
    if m is None: return None
    m.set("emissiveColor", "1 1 1"); m.set("diffuseColor", "1 1 1" if lawful else diffuse); return m


def splat(root, lawful, only_size=False):
    sc = _scene(root)
    if sc is None: return None
    at = {"url": '"a.splat"'}
    if lawful: at.update({"bboxSize": "2 2 2", "bboxCenter": "0 0 0"})
    elif only_size: at["bboxSize"] = "2 2 2"
    return ET.SubElement(sc, "GaussianSplats", at)


def movie(root, lawful, url='"poster.png"'):
    return _add_shape(root, "MovieTexture", url='"clip.mp4"' if lawful else url)


def version(root, lawful, node="InlineGeometry"):
    sc = _scene(root)
    if sc is None: return None
    root.set("version", "4.1" if lawful else "4.0"); return ET.SubElement(sc, node, {"url": '"a.x3d"'})


def metadata(root, lawful, tag="MetadataString"):
    sh = els(root, "Shape")
    if not sh: return None
    at = {"name": "note", "value": '"x"'}
    if lawful: at["containerField"] = "metadata"
    return ET.SubElement(sh[0], tag, at)


def glsl_active(root, lawful, decl="uniform float active;"):
    return _shader(root, ("uniform float actives;" if lawful else decl) + "\nvoid f(){}")


def shader_raw(root, lawful, body="#version 300 es\nvoid main() { }"):
    return _shader(root, ("data:text/plain," + body) if lawful else body)


def loop_seam(root, lawful, end="last"):
    """A looping TimeSensor routed to an interpolator that spans 0..1. lawful closes the loop (last value = first value);
    unlawful leaves the seam open by moving one component of the last ('last') or of the first ('first') value by 0.7. It edits
    keyValue tokens in place, so every other digit of the scene is untouched."""
    defs = {}
    for e in root.iter():
        if e.get("DEF") and e.get("DEF") not in defs: defs[e.get("DEF")] = e
    for r in els(root, "ROUTE"):
        clock, interp = defs.get(r.get("fromNode")), defs.get(r.get("toNode"))
        if clock is None or interp is None or local(clock.tag) != "TimeSensor" or clock.get("loop") != "true": continue
        if r.get("fromField") != "fraction_changed" or not local(interp.tag).endswith("Interpolator"): continue
        try:
            k = [float(t) for t in interp.get("key", "").replace(",", " ").split()]
        except ValueError: continue
        tok = interp.get("keyValue", "").replace(",", " ").split()
        if len(k) < 2 or not tok or len(tok) % len(k) or k[0] > 1e-6 or k[-1] < 1 - 1e-6: continue
        n = len(tok) // len(k)
        try:
            if lawful: tok[-n:] = tok[:n]
            elif end == "last": tok[-1] = repr(float(tok[-1]) + 0.7)
            else: tok[n - 1] = repr(float(tok[n - 1]) + 0.7)
        except ValueError: continue
        interp.set("keyValue", " ".join(tok)); return interp
    return None


P = __import__("functools").partial
# rule -> [dev, sealed...]
VARIANTS = {
    "route-undefined": [route_undefined, P(route_undefined, end="fromNode")],
    "route-before-def": [route_before_def, P(route_before_def, pos=1)],
    "color-range": [color, P(color, val="-0.1 0.2 0.2", ok="0.0 0.2 0.2"), color_pbr,
                    P(color, val="1.5,0.2,0.2", ok="0.9,0.2,0.2"), P(color, attr="specularColor", val="0.2 1.4 0.2")],
    "color-emissive-white": [emissive_white, P(emissive_white, diffuse="0 0 1"), P(emissive_white, diffuse="0.2 0.9 0.2")],
    "splat-bbox": [splat, P(splat, only_size=True)],
    "movie-not-still": [movie, P(movie, url='"poster.jpg"'), P(movie, url='"Frame.PNG?v=2"')],
    "version-fits-nodes": [version, P(version, node="FontLibrary"), P(version, node="HAnimPose")],
    "metadata-containerfield": [metadata, P(metadata, tag="MetadataDouble"), P(metadata, tag="MetadataInteger")],
    "glsl-reserved-active": [glsl_active, P(glsl_active, decl="uniform vec3 active;"),
                             P(glsl_active, decl="uniform   float   active;"), P(glsl_active, decl="in vec2 active;")],
    "loop-seam": [loop_seam, P(loop_seam, end="first")],
    "shader-raw-source": [shader_raw, P(shader_raw, body="void main() { }\n#version 300 es"), P(shader_raw, body="#version 300 es\nprecision highp float;\nvoid main(){}")],
}
# loop-seam had no mutator, so it entered the benchmark by accident once the corpus held six real hits (28 Nov: the flywheel
# court scenes) and then failed the audit: no sealed variant, and a ROUTE keyword rule scored 0.84 because every real hit has a
# ROUTE. It now has a dev mutator and a sealed variant like the other rules, and lawful near-miss twins.
NOT_COVERED = {"color-keys-sparse": "needs a night-sky colour interpolator pair the mutators do not build",
               "xite-light-zero-pop": "needs a light fade through a ROUTE graph", "xite-transparent-shadow": "same",
               "no-script-under-host": "depends on a host profile, not on the file alone"}


def ckey(text: str) -> str:
    """Partition key: identical scene bytes always share a group, whatever their path (review finding: 31 duplicate groups
    crossed the path-hash split)."""
    return hashlib.sha1(text.encode("utf-8", "replace")).hexdigest()


def group(key: str) -> str:
    h = int(hashlib.sha1(key.encode()).hexdigest(), 16) % 10
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
    seen, uniq = set(), []                      # one row per distinct content: duplicates would otherwise multiply a scene
    for p, x, h in out:
        k = ckey(x)
        if k in seen: continue
        seen.add(k); uniq.append((p, x, h))
    return uniq


def _ser(el): return ET.tostring(el, encoding="unicode")


def _fires(rid, xml):
    return rid in [h.rule for h in traps.check(xml.encode())]


def _facts(root):
    """(tag, attribute, value) and (tag, '#text', text) triples: what a scene literally says."""
    out = set()
    for e in root.iter():
        for k, v in e.attrib.items(): out.add((local(e.tag), local(k), v))
        if (e.text or "").strip(): out.add((local(e.tag), "#text", e.text.strip()))
    return out


def build():
    cs = corpus()
    clean = [(p, x) for p, x, h in cs if not h]
    cases = {}
    for rid, rule in traps.RULES.items():
        if rid in NOT_COVERED: continue
        pos, twins, fp = [], {}, set()
        for p, x, h in cs:
            if rid in h: pos.append((p, x, None, "natural", ckey(x)))
        for p, x in clean:
            k = ckey(x); g = group(k); vs = VARIANTS.get(rid)
            if not vs: continue
            vi = 0 if g != "held" or len(vs) == 1 else 1 + int(k, 16) % (len(vs) - 1)
            try: root = ET.fromstring(x)
            except ET.ParseError: continue
            el = vs[vi](root, False)
            if el is None: continue
            mx = _ser(root)
            if not _fires(rid, mx): continue                           # the oracle must see the mutant
            par = {c: pp for pp in root.iter() for c in pp}
            pos.append((p, mx, _ser(par.get(el, el))[:700], f"mutant-v{vi}", k)); twins[p] = (x, k)
            if vi == 0 and not fp: fp = _facts(root) - _facts(ET.fromstring(x))
            nroot = ET.fromstring(x)
            if vs[vi](nroot, True) is not None:
                nx = _ser(nroot)
                if not _fires(rid, nx): twins[p + " (near-miss)"] = (nx, k)
        if len(pos) < 6: continue
        c = {"rule": rid, "incident": rule.origin, "runtime": rule.runtime, "severity": rule.severity,
             "sealed_variants": max(0, len(VARIANTS.get(rid, [])) - 1), "fingerprint": sorted(fp)[:12]}
        for g in ("show", "train", "held"):
            c[f"pos_{g}"] = [(p, x, ctx) for p, x, ctx, kind, k in pos if group(k) == g]
            c[f"neg_{g}"] = [(p, x) for p, x in clean if group(ckey(x)) == g]
            c[f"twin_{g}"] = [(p, x) for p, (x, k) in twins.items() if group(k) == g]
        if c["pos_held"] and c["pos_train"]:
            cases[rid] = c
    return cases


def _eval(src, items, seed, runner):
    import random as _r
    order = list(range(len(items))); _r.Random(seed).shuffle(order)
    res, err = runner(src, [items[i][2] for i in order])
    back = [None] * len(items)
    for pos_, i in enumerate(order): back[i] = res[pos_]
    return back, err


def run_rule(src, pos, neg, twin=(), runner=None, seeds=(0, 1)):
    """score = recall on positives x specificity on clean scenes x specificity on twins and lawful near-misses.
    Hardening after the 18 Nov external review: every scene is run in a fresh namespace (no state can carry a count or an
    order), evaluation order is shuffled under several seeds and the WORST seed is scored, and the feedback carries the
    offending XML so a reflection model sees why, not only which file."""
    from sandbox import run
    runner = runner or run
    items = [("pos", p, x, ctx) for p, x, ctx in pos] + [("neg", p, x, None) for p, x in neg] + [("twin", p, x, None) for p, x in twin]
    worst = None
    for sd in seeds:
        back, err = _eval(src, [(k, p, x) for k, p, x, _ in items], sd, runner)
        P = [(i, r) for i, (k, *_r) in enumerate(items) for kk, r in [(k, back[i])] if k == "pos"]
        tpr = sum(1 for i, r in P if r is True) / max(1, len(pos))
        N = [back[i] for i, it in enumerate(items) if it[0] == "neg"]; T = [back[i] for i, it in enumerate(items) if it[0] == "twin"]
        tnr = sum(1 for r in N if r is False) / max(1, len(neg))
        tw_idx = [i for i, it in enumerate(items) if it[0] == "twin"]
        parts = []                                   # unmutated twins and near-misses are scored separately; the worse one counts
        for want in (False, True):
            sel = [back[i] for i in tw_idx if ("near-miss" in items[i][1]) == want]
            if sel: parts.append(sum(1 for r in sel if r is False) / len(sel))
        tnt = min(parts) if parts else 1.0
        row = {"tpr": round(tpr, 3), "tnr": round(tnr, 3), "tnr_twin": round(tnt, 3), "score": round(tpr * tnr * tnt, 3), "error": err}
        row["_back"] = back
        if worst is None or row["score"] < worst["score"]: worst = row
    back = worst.pop("_back")
    missed = [(items[i][1], items[i][3]) for i, it in enumerate(items) if it[0] == "pos" and back[i] is not True][:3]
    fps = [items[i][1] for i, it in enumerate(items) if it[0] != "pos" and back[i] is not False][:4]
    worst["missed"] = [m[0] for m in missed]; worst["missed_xml"] = [(m[1] or "")[:400] for m in missed]
    worst["false_alarms"] = fps
    return worst


def oracle_rows(case, split):
    """The shipped witness as the reference rule (must be 1.0 on positives, clean scenes AND twins/near-misses)."""
    rid = case["rule"]
    f = lambda x: _fires(rid, x)  # noqa: E731
    pos, neg, tw = case[f"pos_{split}"], case[f"neg_{split}"], case[f"twin_{split}"]
    tp = sum(f(x) for _, x, *_ in pos) / len(pos); tn = sum(not f(x) for _, x in neg) / len(neg)
    tt = sum(not f(x) for _, x in tw) / len(tw) if tw else 1.0
    return {"tpr": tp, "tnr": tn, "tnr_twin": tt, "score": tp * tn * tt}


DEGENERATE = {
    "always-true": "def trap(root):\n    return True\n",
    "always-false": "def trap(root):\n    return False\n",
    "has-route": "def trap(root):\n    return any(e.tag.endswith('ROUTE') for e in root.iter())\n",
    "has-material": "def trap(root):\n    return any(e.tag.endswith('Material') for e in root.iter())\n",
    "big-scene": "def trap(root):\n    return len(list(root.iter())) > 60\n",
    "has-metadata": "def trap(root):\n    return any('Metadata' in e.tag for e in root.iter())\n",
}


def stateful_source(n):
    """Cheats by call count: true for the first n scenes it sees. Harmless once every scene runs in a fresh namespace."""
    return f"calls = [0]\ndef trap(root):\n    calls[0] += 1\n    return calls[0] <= {n}\n"


def fingerprint_source(case):
    """Memorises the exact (tag, attribute, value) the dev mutator planted. Must lose on sealed variants."""
    fp = sorted(case["fingerprint"])
    return (f"FP = {fp!r}\ndef trap(root):\n    for e in root.iter():\n        t = e.tag.rsplit('}}', 1)[-1]\n"
            "        for k, v in e.attrib.items():\n            if [t, k.rsplit('}', 1)[-1], v] in FP or (t, k, v) in FP:\n                return True\n"
            "        if e.text and e.text.strip() and [t, '#text', e.text.strip()] in FP:\n            return True\n    return False\n")
