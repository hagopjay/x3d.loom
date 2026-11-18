"""Run a model-written trap rule without trusting it.

A candidate is Python source defining `def trap(root) -> bool` over an ElementTree root. It is screened by AST
(no imports, no underscore names, no open/exec/eval/getattr), run in a fresh `python3 -I` child with a CPU and memory
limit, and given only ET, re, math and colorsys. This is a guard against sloppy code and runaway loops, not a security
boundary against a hostile author: run proposers only on a machine you do not mind losing a scratch directory on.
"""
from __future__ import annotations

import ast
import json
import subprocess
import sys
from pathlib import Path

BANNED_CALLS = {"open", "exec", "eval", "compile", "getattr", "setattr", "delattr", "globals", "locals", "vars",
                "input", "__import__", "breakpoint", "type", "memoryview", "super", "object"}


def screen(src: str) -> str | None:
    """Return a reason the source is refused, or None."""
    try:
        tree = ast.parse(src)
    except SyntaxError as e:
        return f"syntax error: {e.msg} (line {e.lineno})"
    has_trap = False
    for n in ast.walk(tree):
        if isinstance(n, (ast.Import, ast.ImportFrom)):
            return "imports are not allowed; ET, re, math and colorsys are already in scope"
        if isinstance(n, ast.Attribute) and n.attr.startswith("_"):
            return f"attribute {n.attr!r} is not allowed"
        if isinstance(n, ast.Name) and n.id.startswith("__"):
            return f"name {n.id!r} is not allowed"
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id in BANNED_CALLS:
            return f"call to {n.func.id}() is not allowed"
        if isinstance(n, ast.FunctionDef) and n.name == "trap" and len(n.args.args) == 1:
            has_trap = True
    return None if has_trap else "define def trap(root): ... returning True when the trap is present"


_WORKER = Path(__file__).with_name("_worker.py")


def run(src: str, xmls: list[str], timeout: float = 30.0) -> tuple[list, str | None]:
    """Return ([True|False|None per xml], error). None means the rule raised on that file."""
    why = screen(src)
    if why:
        return [None] * len(xmls), why
    try:
        p = subprocess.run([sys.executable, "-I", str(_WORKER)], input=json.dumps({"src": src, "xmls": xmls}),
                           capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return [None] * len(xmls), f"timed out after {timeout:.0f}s"
    if p.returncode != 0:
        return [None] * len(xmls), "worker failed: " + (p.stderr.strip().splitlines() or ["?"])[-1][:200]
    out = json.loads(p.stdout)
    return out["results"], out.get("error")
