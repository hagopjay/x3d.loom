"""Leak sweep (law 16: public pages pass a leak sweep first).

Copies a tree to a destination, applies the ordered replacements in a rules file to text files, then
fails if any forbidden pattern survives anywhere in the copy, binary files included. The source tree
is never modified. Rules: kit/profiles/public-sweep.json.

  python -m loomkit sweep SRC DEST --rules RULES.json [--exclude NAME ...]
"""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

from .core import need, sha256_file

TEXT_SUFFIXES = {".md", ".txt", ".json", ".py", ".sh", ".yml", ".yaml", ".x3d", ".html", ".cjs", ".js", ""}


def load_rules(path: Path) -> dict:
    rules = json.loads(Path(path).read_text())
    need(rules.get("schema") == "loom.sweep-rules/1", "SWEEP_RULES_SCHEMA")
    for r in rules["replace"]:
        re.compile(r["pattern"])
    return rules


def _overlap(src: Path, dest: Path) -> str | None:
    if src == dest:
        return "destination is the source"
    if dest in src.parents:
        return "destination contains the source"
    if src in dest.parents:
        return "destination is inside the source"
    return None


def sweep(src: Path, dest: Path, rules: dict, exclude: set[str]) -> dict:
    """Copy, redact and check. Nothing that exists is touched until the complete copy is written and checked (final
    external scan, 18 Nov 2026, defect 1: the only guard was `dest inside src`, so src == dest or dest = src's parent
    reached rmtree(dest) and deleted the source, and its siblings, before exiting 2). The copy is staged beside the
    destination; a clean copy replaces the destination, a copy with residue is left at DEST.sweep-failed and the
    previous destination is kept."""
    import os, tempfile
    src, dest = Path(src).resolve(), Path(dest).resolve()
    need(src.is_dir(), "SWEEP_SRC_MISSING", f"{src} is not a directory")
    why = _overlap(src, dest)
    need(why is None, "SWEEP_DEST_INSIDE_SRC" if why == "destination is inside the source" else "SWEEP_OVERLAP", f"{why}: {src} / {dest}")
    need(not dest.exists() or dest.is_dir(), "SWEEP_OVERLAP", f"{dest} exists and is not a directory")
    dest.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix="." + dest.name + ".", suffix=".staged", dir=dest.parent))
    try:
        report = _copy_and_check(src, stage, rules, exclude)
    except BaseException:
        shutil.rmtree(stage, ignore_errors=True)
        raise
    if report["status"] == "pass":
        old = None
        if dest.exists():
            old = Path(tempfile.mkdtemp(prefix="." + dest.name + ".", suffix=".previous", dir=dest.parent)); old.rmdir()
            os.replace(dest, old)
        os.replace(stage, dest)
        if old is not None:
            shutil.rmtree(old)
        report["placed"] = str(dest)
    else:
        failed = dest.with_name(dest.name + ".sweep-failed")
        need(_overlap(src, failed) is None, "SWEEP_OVERLAP", f"{failed} overlaps the source")
        if failed.exists():
            shutil.rmtree(failed)
        os.replace(stage, failed)
        report["placed"] = str(failed)
        report["destination_kept"] = dest.exists()
    return report


def _copy_and_check(src: Path, dest: Path, rules: dict, exclude: set[str]) -> dict:
    changed: dict[str, int] = {}
    for p in sorted(src.rglob("*")):
        rel = p.relative_to(src)
        if any(part in exclude for part in rel.parts) or not p.is_file():
            continue
        out = dest / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        if p.suffix in TEXT_SUFFIXES:
            text = p.read_text(encoding="utf-8", errors="strict")
            n = 0
            for r in rules["replace"]:
                text, k = re.subn(r["pattern"], r["with"], text)
                n += k
            out.write_text(text, encoding="utf-8")
            if n:
                changed[rel.as_posix()] = n
        else:
            shutil.copy2(p, out)
        out.chmod(p.stat().st_mode)
    residue = []
    forbidden = [re.compile(f) for f in rules["forbid"]]
    for p in sorted(dest.rglob("*")):
        if p.is_file():
            data = p.read_bytes().decode("utf-8", errors="replace")
            for f in forbidden:
                for m in f.finditer(data):
                    residue.append({"file": p.relative_to(dest).as_posix(), "pattern": f.pattern, "match": m.group(0)[:60]})
    report = {"schema": "loom.sweep-report/1", "rules_sha256": sha256_file(rules["_path"]) if "_path" in rules else None,
              "files_changed": changed, "replacements": sum(changed.values()), "residue": residue,
              "status": "pass" if not residue else "fail"}
    return report
