"""The package is stdlib only, never touches the network, and keeps its safety in raising code, not in assert."""
import ast
import os
import sys

PKG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "x3d_s1")
FORBIDDEN = {"socket", "ssl", "http", "urllib", "requests", "httpx", "aiohttp", "anthropic", "openai", "typesafe_sdk", "subprocess"}


def sources():
    for f in sorted(os.listdir(PKG)):
        if f.endswith(".py"):
            p = os.path.join(PKG, f)
            with open(p, encoding="utf-8") as fh:
                yield f, ast.parse(fh.read(), filename=p)


def test_no_assert_statements_in_package_code():
    bad = [(f, n.lineno) for f, tree in sources() for n in ast.walk(tree) if isinstance(n, ast.Assert)]
    assert bad == [], f"assert is stripped under python -O; use raise: {bad}"


def test_no_network_or_vendor_sdk_imports():
    hits = []
    for f, tree in sources():
        for n in ast.walk(tree):
            mods = []
            if isinstance(n, ast.Import):
                mods = [a.name for a in n.names]
            elif isinstance(n, ast.ImportFrom) and n.module and n.level == 0:
                mods = [n.module]
            hits += [(f, m) for m in mods if m.split(".")[0] in FORBIDDEN]
    assert hits == [], hits


def test_only_standard_library_is_imported():
    std = set(sys.stdlib_module_names)
    outside = []
    for f, tree in sources():
        for n in ast.walk(tree):
            mods = []
            if isinstance(n, ast.Import):
                mods = [a.name for a in n.names]
            elif isinstance(n, ast.ImportFrom) and n.module and n.level == 0:
                mods = [n.module]
            outside += [(f, m) for m in mods if m.split(".")[0] not in std and m.split(".")[0] != "x3d_s1"]
    assert outside == [], outside
