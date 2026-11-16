"""Hierarchical choice: walk a taxonomy with one Choice per node, beam search over paths, fall back to the parent.

Why it matters for X3D: the node hierarchy is a ready-made taxonomy, and a flat Choice is capped at 255 options while the
Web3D JSON Schema 4.0 defines 261 nodes (x3d.docs chapter 16). Descend by component instead. Re-derived from the public
'hierarchical classification' pattern: score a path by the geometric mean of its edge probabilities, so a deep leaf is not
penalised for taking more decisions; when unsure of the leaf, report its parent (no second call needed).
"""
from __future__ import annotations

import math
from typing import Callable, Mapping, Sequence


def path_score(edge_probs: Sequence[float]) -> float:
    if not edge_probs:
        return 0.0
    if any(p <= 0 for p in edge_probs):
        return 0.0
    return math.exp(sum(math.log(p) for p in edge_probs) / len(edge_probs))


def beam_classify(root: str, children: Mapping[str, Sequence[str]],
                  ask: Callable[[str, Sequence[str]], Mapping[str, float]], beam: int = 3, top: int = 3) -> list[dict]:
    """children: node -> child list (empty or missing = leaf). ask(node, kids) -> {kid: probability} (one Choice call per
    expanded node). Returns up to `top` complete paths: [{'path': [...], 'edges': [...], 'score': geometric_mean}]."""
    live = [{"path": [root], "edges": []}]
    done = []
    while live:
        nxt = []
        for cand in live:
            node = cand["path"][-1]
            kids = list(children.get(node, ()))
            if not kids:
                done.append(cand)
                continue
            probs = ask(node, kids)
            for k in kids:
                nxt.append({"path": cand["path"] + [k], "edges": cand["edges"] + [float(probs[k])]})
        for c in nxt:
            c["score"] = path_score(c["edges"])
        nxt.sort(key=lambda c: c["score"], reverse=True)
        live = nxt[:beam]
    for c in done:
        c["score"] = path_score(c["edges"])
    done.sort(key=lambda c: c["score"], reverse=True)
    return done[:top]


def classify_with_fallback(root: str, children: Mapping[str, Sequence[str]],
                           ask: Callable[[str, Sequence[str]], Mapping[str, float]], min_p: float = 0.7) -> dict:
    """Greedy descent that stops, and reports the parent, at the first level where the best child is below `min_p`.
    Returns {'label': node, 'path': [...], 'stopped_early': bool, 'edges': [...]}."""
    path, edges = [root], []
    while True:
        kids = list(children.get(path[-1], ()))
        if not kids:
            return {"label": path[-1], "path": path, "edges": edges, "stopped_early": False}
        probs = ask(path[-1], kids)
        best = max(kids, key=lambda k: probs[k])
        if probs[best] < min_p:
            return {"label": path[-1], "path": path, "edges": edges, "stopped_early": True}
        path.append(best)
        edges.append(float(probs[best]))
