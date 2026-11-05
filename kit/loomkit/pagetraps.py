"""Page-traps witness: has this page code already cost us once?

The X3D traps witness (traps.py) reads scenes. This one reads the JavaScript that drives them, for the
runtime contracts x3d.STEM paid for (Loom law 32). It is a static, standard-library reader: each rule is
a narrow pattern with a named incident, tested on both sides in tests/test_gates.py. A clean result means
none of these known traps is present, not that the page is correct; the page's own browser evidence
remains the witness for behaviour.

Rules are labelled with the runtime they were observed on: a browser fact must not become a universal
prohibition (the same discipline as traps.py).
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class Hit:
    rule: str
    severity: str
    where: str
    detail: str


@dataclass
class Rule:
    id: str
    severity: str
    runtime: str
    origin: str


RULES = {
    "xite-callback-unguarded": Rule("xite-callback-unguarded", "error", "X_ITE 16.5.1",
        "One exception escaping a field callback left the routing guard set and froze every route in the scene "
        "(X_ITE teardown F02; reproduced on the Turing Garden page, 5 Nov; Loom failure mode 88). The callback body must start with try."),
    "xite-browser-currenttime": Rule("xite-browser-currenttime", "error", "X_ITE 16.5.1",
        "Browser.currentTime is undefined in X_ITE; a NaN TimeSensor startTime froze playback silently (Turing Garden, failure mode 72). Use getCurrentTime()."),
    "nav-before-scene": Rule("nav-before-scene", "error", "any (X_ITE pages)",
        "A hashchange listener registered before the scene loaded reached the case loader with no scene (Electron Cloud and Turing Garden, failure mode 78). "
        "Heuristic: the listener must appear after the loadURL call in the file."),
    "window-global-shadow": Rule("window-global-shadow", "error", "browsers (classic scripts)",
        "A top-level const named top collided with window.top and the page script never ran (Electron Cloud, failure mode 77)."),
    "js-syntax": Rule("js-syntax", "error", "Node.js syntax check (node --check)",
        "A hardening script left '}););' in the vortex page; the script never ran, yet every pattern rule passed it (5 Nov, failure mode 92). "
        "A page that does not parse trivially avoids every other trap, so syntax is checked first."),
    "loadurl-unbudgeted": Rule("loadurl-unbudgeted", "warning", "X_ITE 16.6.1 (source reading)",
        "replaceWorld can leave its promise pending when an internal wait rejects (X_ITE teardown F01, L2; not reproduced here, failure mode 89). "
        "Give the world load a time budget (Promise.race with a timeout)."),
}

WINDOW_PROPS = {"top", "name", "status", "parent", "length", "origin", "self", "frames", "location", "history",
                "closed", "opener", "event", "external", "screen", "window", "document", "navigator"}


def _line(src: str, pos: int) -> int:
    return src.count("\n", 0, pos) + 1


def strip_comments(src: str) -> str:
    """Blank out // and /* */ comments (newlines kept, so line numbers hold), leaving strings, template
    literals and regex-free code intact. A comment that explains a trap must not trip it (the first run
    flagged the Electron Cloud page's own warning comment about Browser.currentTime)."""
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if c in "\"'`":
            j = i + 1
            while j < n and src[j] != c:
                j += 2 if src[j] == "\\" else 1
            out.append(src[i:j + 1]); i = j + 1
        elif src.startswith("//", i):
            j = src.find("\n", i)
            j = n if j < 0 else j
            out.append(" " * (j - i)); i = j
        elif src.startswith("/*", i):
            j = src.find("*/", i + 2)
            j = n if j < 0 else j + 2
            out.append("".join(ch if ch == "\n" else " " for ch in src[i:j])); i = j
        else:
            out.append(c); i += 1
    return "".join(out)


def syntax(src: str, path: str = "<page>") -> list[Hit]:
    """Parse the page with node --check. Fails closed: without Node the check raises, it never passes."""
    import shutil, subprocess, tempfile, os
    node = shutil.which("node")
    if not node:
        raise RuntimeError("PAGE_SYNTAX_UNCHECKED: node is not on PATH")
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(src)
        tmp = f.name
    try:
        r = subprocess.run([node, "--check", tmp], capture_output=True, text=True, timeout=60)
    finally:
        os.unlink(tmp)
    if r.returncode == 0:
        return []
    msg = next((l for l in r.stderr.splitlines() if "Error" in l), r.stderr.strip()[:200])
    line = next((l.split(":")[-1] for l in r.stderr.splitlines() if l.startswith(tmp)), "?")
    return [Hit("js-syntax", "error", f"{path}:{line}", msg[:200])]


def check(src: str, path: str = "<page>") -> list[Hit]:
    hits: list[Hit] = syntax(src, path)
    src = strip_comments(src)
    # 1. every addFieldCallback whose callback is an inline function must open with try
    for m in re.finditer(r"addFieldCallback\s*\(", src):
        tail = src[m.end():m.end() + 600]
        fn = re.search(r"(=>\s*\{|function\s*\([^)]*\)\s*\{)", tail)
        if not fn:
            hits.append(Hit("xite-callback-unguarded", "warning", f"{path}:{_line(src, m.start())}",
                            "callback passed by reference: put try/catch inside that function (not checked here)"))
            continue
        body = tail[fn.end():].lstrip()
        if not body.startswith("try"):
            hits.append(Hit("xite-callback-unguarded", "error", f"{path}:{_line(src, m.start())}", "callback body does not start with try"))
    # 2. Browser.currentTime
    for m in re.finditer(r"\b(?:B|browser|Browser|X3D\.getBrowser\([^)]*\))\.currentTime\b", src):
        hits.append(Hit("xite-browser-currenttime", "error", f"{path}:{_line(src, m.start())}", m.group(0)))
    # 3. navigation wired before the scene is loaded (file order)
    load = re.search(r"\.loadURL\s*\(", src)
    for m in re.finditer(r"addEventListener\s*\(\s*[\"']hashchange[\"']", src):
        if load is None or m.start() < load.start():
            hits.append(Hit("nav-before-scene", "error", f"{path}:{_line(src, m.start())}",
                            "hashchange listener appears before loadURL" if load else "hashchange listener but no loadURL in this file"))
    # 4. top-level declarations that shadow window properties (classic scripts share the global scope)
    for m in re.finditer(r"^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)", src, flags=re.M):
        if m.group(1) in WINDOW_PROPS:
            hits.append(Hit("window-global-shadow", "error", f"{path}:{_line(src, m.start())}", f"top-level {m.group(1)}"))
    # 5. world loads without a time budget
    for m in re.finditer(r"await\s+[\w.]*loadURL\s*\(", src):
        window = src[max(0, m.start() - 200):m.start() + 300]
        if "Promise.race" not in window and "timeout" not in window.lower():
            hits.append(Hit("loadurl-unbudgeted", "warning", f"{path}:{_line(src, m.start())}", "await loadURL without a time budget"))
    return hits
