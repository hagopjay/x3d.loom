"""Fold-back witness: does a PR-style fold-back patch apply cleanly and do its own controls hold?

Every project PR patch in the Loom folder has the same shape (LEARNINGS-from-patches.md, "The PR shape"):
an additions-only directory under tools/<name>/, a README, and a smoke.py that must pass under normal
Python and `python -O`. This witness re-checks exactly that claim in an empty temporary git repo.

The patch's smoke test is the patch author's code: it runs in a throwaway directory with `python -E -s`
(no environment variables, no user site), exactly as the PR README says: `python3 tools/<name>/smoke.py`.
Not `-I`: since Python 3.11 that also drops the script's own directory from sys.path, so a smoke test
cannot import its sibling package. That mistake was made once here and showed up, correctly, as status
`error` rather than a false `fail` (LEARNINGS-from-patches.md, "the instrument is tested too").
A missing dependency is status `error` (the instrument could not complete), not `fail`.

Target-bound mode (review 18 Nov 2026, defect 10): `--target REPO --base SHA --consumer CMD` clones the real target
repository at the named base commit, runs the consumer's OWN command there before the patch (the baseline), applies
the patch with `git apply --check` against that base, and runs the same command after. The record keeps both
outcomes and the full base SHA. Pass needs the patch to apply to that base and the consumer command to exit 0 after;
a patch that turns a passing consumer red is a regression (fail), and one that turns a red consumer green is recorded
as an improvement. Modifications are allowed in this mode, because a real exporter or bridge repair edits files.
The empty-repository mode stays for additions-only PR patches, and its record says `target_bound: false`, so a
profile can demand `{"target_bound": true}` (kit/profiles/x3d-static-v2.json).
"""
from __future__ import annotations

import re
import shlex
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from .core import portable


class PatchParseError(Exception):
    pass


def patch_files(patch: Path) -> list[dict]:
    r"""List target files and whether each is an addition, from git's own parser (third review, 18 Nov 2026: a regex
    over `diff --git a/\S+ b/(\S+)` crashed on `my scene.txt` and on C-quoted `café.txt`, which git applies fine).
    `git apply --numstat -z` gives NUL-separated paths with no quoting; `--summary` names created files."""
    with tempfile.TemporaryDirectory(prefix="loom-patch-parse-") as td:
        num = subprocess.run(["git", "apply", "--numstat", "-z", str(Path(patch).resolve())], cwd=td, capture_output=True)
        summ = subprocess.run(["git", "apply", "--summary", "-z", str(Path(patch).resolve())], cwd=td, capture_output=True)
    if num.returncode != 0:
        raise PatchParseError("git apply --numstat: " + num.stderr.decode("utf-8", "replace").strip()[-300:])
    raw = num.stdout.decode("utf-8", "surrogateescape").split("\0")
    paths, i = [], 0
    while i < len(raw):
        rec = raw[i]
        if not rec:
            i += 1; continue
        cols = rec.split("\t", 2)
        if len(cols) == 3 and cols[2] == "":        # rename/copy: the next two fields are old and new paths
            paths.append(raw[i + 2]); i += 3
        else:
            paths.append(cols[2]); i += 1
    created = set()
    for line in summ.stdout.decode("utf-8", "surrogateescape").splitlines():
        m = re.match(r"\s*create mode \d+ (.+)$", line)
        if m:
            created.add(m.group(1))
    return [{"path": x, "added": x in created} for x in paths]


def freeze(patch: Path, into: Path) -> tuple[Path, str]:
    """Read the patch ONCE, write a private copy and return (copy, sha256 of those bytes). Every later step (listing,
    apply --check, apply) reads the copy, so the hash on the record is the hash of the bytes applied, even if the
    original file changes while the consumer runs (review round 2, 18 Nov 2026, defect 1: hash A, apply B)."""
    import hashlib
    data = Path(patch).read_bytes()
    snap = Path(into) / "frozen.patch"
    snap.write_bytes(data)
    snap.chmod(0o400)
    return snap, hashlib.sha256(data).hexdigest()


def glob_re(g: str):
    """ONE glob language for --scorer/--impl, independent of the Python version (fourth review: Path.glob('tests/**')
    matched only directories on 3.12 and files too on 3.13). Paths are repo-relative POSIX; `**` spans directories,
    `*` and `?` stay inside one path segment; a pattern ending in `/**` matches every file below that directory."""
    import re as _re
    out, i = "", 0
    while i < len(g):
        if g.startswith("**/", i):
            out += "(?:.*/)?"; i += 3
        elif g.startswith("**", i):
            out += ".*"; i += 2
        elif g[i] == "*":
            out += "[^/]*"; i += 1
        elif g[i] == "?":
            out += "[^/]"; i += 1
        else:
            out += _re.escape(g[i]); i += 1
    return _re.compile(out + r"\Z")


def matches(path: str, globs: list[str]) -> bool:
    return any(glob_re(g).match(path) for g in globs)


def inventory(repo: Path, globs: list[str]) -> dict:
    """The EFFECTIVE scorer: every path under the repo (not .git) that a declared glob matches, with its type, the
    symlink text and the bytes a reader of it gets (fourth review, defects 2 and 3: a declared expected.json that is a
    symlink kept its own bytes while its target changed; a renamed-away case file just stopped being discovered)."""
    import hashlib, os
    inv = {}
    if not globs:
        return inv
    for dirpath, dirnames, filenames in os.walk(repo, followlinks=False):
        dirnames[:] = [d for d in dirnames if d != ".git" and not os.path.islink(os.path.join(dirpath, d))]
        names = filenames + [d for d in os.listdir(dirpath) if os.path.islink(os.path.join(dirpath, d)) and d not in filenames]
        for n in names:
            full = Path(dirpath) / n
            rel = full.relative_to(repo).as_posix()
            if ".git" in rel.split("/") or not matches(rel, globs):
                continue
            row = {"type": "symlink" if full.is_symlink() else "file"}
            if full.is_symlink():
                row["link"] = os.readlink(full)
            try:
                real = full.resolve(strict=True)
                row["sha256"] = hashlib.sha256(real.read_bytes()).hexdigest() if real.is_file() else "not-a-file"
                row["resolves_inside"] = repo.resolve() in real.parents or real == repo.resolve()
            except (OSError, RuntimeError):
                row["sha256"] = "dangling"
            inv[rel] = row
    return inv


SHELLS = {"sh", "bash", "zsh", "dash", "ksh", "env", "make", "npm", "npx", "node", "tox", "nox", "just"}


def scorer_paths(files: list[dict], consumer_cmd: list[str], declared: list[str] | None = None) -> list[str]:
    """Patch paths that may change the oracle: test-looking files, a file the consumer command names, or a file
    matching a declared scorer glob (`--scorer`). Only the declared set can make an unchanged claim (see closure())."""
    named = {Path(a).as_posix().lstrip("./") for a in consumer_cmd}
    out = []
    for f in files:
        parts = f["path"].split("/")
        if f["path"] in named or any(x in ("test", "tests") for x in parts[:-1]) or parts[-1].startswith("test_") \
                or parts[-1].endswith(("_test.py", ".test.mjs", ".test.js")) or parts[-1] in ("conftest.py", "package.json") \
                or matches(f["path"], declared or []):
            out.append(f["path"])
    return sorted(set(out))


def closure(files: list[dict], consumer_cmd: list[str], scorer: list[str], impl: list[str], repo: Path) -> dict:
    """Is the oracle known to be unchanged? Third review, 18 Nov 2026, defect 2: an edited expected.json, or a check.py
    run through `sh -c`, passed the name heuristic. Now `unchanged` is True only when the caller DECLARED the scorer
    closure (`--scorer` globs: entry point, helpers, expected data, config), the patch touches none of it, and, when
    `--impl` globs are given, every patch path is declared implementation. Undeclared means unknown, never unchanged.
    The declared scorer files are hashed at the base so the record names the exact oracle bytes."""
    hit = scorer_paths(files, consumer_cmd, scorer)
    outside = [f["path"] for f in files if impl and not matches(f["path"], impl)]
    wrapper = bool(consumer_cmd) and Path(consumer_cmd[0]).name in SHELLS
    inv = inventory(repo, scorer)
    hashed = {k: v["sha256"] for k, v in inv.items()}
    if not scorer:
        state, why = "unknown", "no --scorer closure declared" + (" and the consumer is a wrapper (" + consumer_cmd[0] + ")" if wrapper else "")
    elif not hashed:
        state, why = "unknown", "the declared --scorer globs match no file at the base"
    elif hit:
        state, why = "changed", "patch edits scorer files: " + ", ".join(hit[:5])
    elif outside:
        state, why = "unknown", "patch edits files outside the declared --impl set: " + ", ".join(outside[:5])
    else:
        state, why = "unchanged", "patch touches no declared scorer file"
    return {"state": state, "reason": why, "declared_scorer": scorer, "declared_impl": impl,
            "scorer_files_at_base": hashed, "inventory_at_base": inv, "consumer_wrapper": wrapper, "changed": hit, "outside_impl": outside}


def _run(cmd: list[str], cwd: Path, timeout: int) -> dict:
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    return {"exit_code": p.returncode, "stdout_tail": (p.stdout.strip().splitlines() or [""])[-1][:300],
            "stderr_tail": (p.stderr.strip().splitlines() or [""])[-1][:300]}


def check_target(patch: Path, target: Path, base: str, consumer: str, timeout: int = 900,
                 scorer: list[str] | None = None, impl: list[str] | None = None) -> dict:
    """Apply a fold-back patch to a clean clone of the real target at `base`; run the consumer's command before and after."""
    original, target = Path(patch).resolve(), Path(target).resolve()
    hold = tempfile.TemporaryDirectory(prefix="loom-foldback-patch-")
    patch, digest = freeze(original, Path(hold.name))
    try:
        return _check_target(original, patch, digest, target, base, consumer, timeout, list(scorer or []), list(impl or []))
    finally:
        hold.cleanup()


def _parse_or_error(patch: Path, original: Path, digest: str, target_bound: bool):
    try:
        return patch_files(patch), None
    except PatchParseError as e:   # an instrument error is a witness record (status error), not a crash
        return None, {"patch": portable(original), "patch_sha256": digest, "patch_frozen": True, "files": 0,
                      "target_bound": target_bound, "smoke": [], "status": "error", "reason": str(e),
                      "scorer_changed": [], "scorer_closure": {"state": "unknown", "reason": "patch did not parse"}}


def _check_target(original: Path, patch: Path, digest: str, target: Path, base: str, consumer: str, timeout: int,
                  scorer: list[str], impl: list[str]) -> dict:
    files, err = _parse_or_error(patch, original, digest, True)
    if err:
        return err
    result = {"patch": portable(original), "patch_sha256": digest, "patch_frozen": True, "files": len(files),
              "additions_only": bool(files) and all(f["added"] for f in files), "target_bound": True,
              "target": target.name, "base_requested": base, "base_sha": None, "consumer": consumer,
              "consumer_before": None, "consumer_after": None, "apply_check": None, "outcome": None,
              "smoke": [], "status": None, "reason": ""}
    if not consumer.strip():
        result.update(status="fail", reason="target-bound fold-back needs --consumer: the target's own regression command")
        return result
    rev = subprocess.run(["git", "-C", str(target), "rev-parse", "--verify", "--quiet", base + "^{commit}"],
                         capture_output=True, text=True)
    if rev.returncode != 0:
        result.update(status="error", reason=f"base {base!r} is not a commit in the target repository")
        return result
    result["base_sha"] = rev.stdout.strip()
    cmd = shlex.split(consumer)
    result["scorer_changed"] = scorer_paths(files, cmd, scorer)
    with tempfile.TemporaryDirectory(prefix="loom-foldback-target-") as td:
        repo = Path(td) / "t"
        subprocess.run(["git", "clone", "-q", "--no-hardlinks", "--no-checkout", str(target), str(repo)], check=True)
        subprocess.run(["git", "-C", str(repo), "checkout", "-q", "--detach", result["base_sha"]], check=True)
        head = subprocess.run(["git", "-C", str(repo), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
        if head != result["base_sha"]:
            result.update(status="error", reason=f"clone is at {head}, not {result['base_sha']}")
            return result
        result["scorer_closure"] = closure(files, cmd, scorer, impl, repo)
        result["consumer_before"] = _run(cmd, repo, timeout)
        # back to the pristine base: the before-run's outputs (a __pycache__ .pyc stamped in the same second as the
        # patched source masked a regression in this mode's own control) must not leak into the after-run
        subprocess.run(["git", "-C", str(repo), "checkout", "-q", "--", "."], check=True)
        subprocess.run(["git", "-C", str(repo), "clean", "-q", "-f", "-d", "-x"], check=True)
        chk = subprocess.run(["git", "-C", str(repo), "apply", "--check", str(patch)], capture_output=True, text=True)
        result["apply_check"] = chk.returncode == 0
        if chk.returncode != 0:
            result.update(status="fail", reason=f"git apply --check failed on base {result['base_sha'][:12]}: " + chk.stderr.strip()[-400:])
            return result
        subprocess.run(["git", "-C", str(repo), "apply", str(patch)], check=True)
        sc = result["scorer_closure"]
        before_inv, after_inv = sc["inventory_at_base"], inventory(repo, scorer)
        moved = sorted(k for k in set(before_inv) | set(after_inv) if before_inv.get(k) != after_inv.get(k))
        sc["inventory_after_patch"] = after_inv
        sc["inventory_changed"] = moved
        if moved:   # compared by effect, not by patch path names: symlink targets, renames, deletions, new files
            sc["changed"] = sorted(set(sc["changed"]) | set(moved))
            if sc["state"] in ("unchanged", "unknown") and sc["declared_scorer"]:
                sc["state"], sc["reason"] = "changed", "the declared scorer inventory differs after the patch: " + ", ".join(moved[:5])
            result["scorer_changed"] = sorted(set(result["scorer_changed"]) | set(moved))
        result["consumer_after"] = _run(cmd, repo, timeout)
        if sc["state"] == "changed" and sc["declared_scorer"]:
            # the patch moved the oracle: score the patched implementation with the BASE scorer, in a FRESH clone
            # (fourth review: replaying in the after-run's tree imported its cached, patched bytecode)
            rp = Path(td) / "replay"
            subprocess.run(["git", "clone", "-q", "--no-hardlinks", "--no-checkout", str(target), str(rp)], check=True)
            subprocess.run(["git", "-C", str(rp), "checkout", "-q", "--detach", result["base_sha"]], check=True)
            subprocess.run(["git", "-C", str(rp), "apply", str(patch)], check=True)
            for k in sorted(set(after_inv) - set(before_inv)):   # scorer files the patch added: not part of the base oracle
                (rp / k).unlink()
            tracked = set(subprocess.run(["git", "-C", str(rp), "ls-tree", "-r", "--name-only", "-z", result["base_sha"]],
                                         capture_output=True, check=True).stdout.decode("utf-8", "surrogateescape").split("\0"))
            targets = set()
            for k, row in before_inv.items():   # a declared symlink's target is part of the oracle it reads
                if row["type"] == "symlink" and row.get("resolves_inside"):
                    real = (repo / k).resolve()
                    if repo.resolve() in real.parents:
                        targets.add(real.relative_to(repo.resolve()).as_posix())
            restore = sorted((set(before_inv) | targets) & tracked)
            if restore:
                subprocess.run(["git", "-C", str(rp), "checkout", "-q", result["base_sha"], "--", *restore], check=True)
            if inventory(rp, scorer) != before_inv:
                result.update(status="error", reason="could not restore the base scorer inventory for the replay")
                return result
            result["consumer_after_base_oracle"] = _run(cmd, rp, timeout)
        for smoke in sorted(repo.glob("tools/*/smoke.py")):
            if any(f["path"] == smoke.relative_to(repo).as_posix() for f in files):
                for flags in ([], ["-O"]):
                    r = _run([sys.executable, "-E", "-s", *flags, str(smoke)], smoke.parent, timeout)
                    result["smoke"].append({"smoke": smoke.relative_to(repo).as_posix(), "optimized": bool(flags), **r})
    before, after = result["consumer_before"]["exit_code"], result["consumer_after"]["exit_code"]
    result["outcome"] = {(0, 0): "held", (1, 0): "improved"}.get((min(before, 1), after), "regressed" if before == 0 else "still failing")
    if result["scorer_changed"] and result["outcome"] in ("held", "improved"):
        # the patch edits the test or a file the consumer runs: green after may be a changed oracle, not a better system
        result["outcome"] += " (scorer changed: " + ", ".join(result["scorer_changed"][:5]) + ")"
    replay = result.get("consumer_after_base_oracle")
    if replay is not None and replay["exit_code"] != 0 and after == 0:
        result["outcome"] += "; fails the base oracle"
        result.update(status="fail", reason=f"green only under the patched scorer; the base scorer exits {replay['exit_code']}")
        return result
    if after != 0:
        result.update(status="fail", reason=f"consumer exits {after} after the patch (before: {before}): {result['outcome']}")
    elif any(s["exit_code"] != 0 for s in result["smoke"]):
        result.update(status="fail", reason="the patch's own smoke failed on the target")
    else:
        result["status"] = "pass"
    return result


def check(patch: Path, python: str = sys.executable, timeout: int = 900) -> dict:
    original = Path(patch).resolve()
    hold = tempfile.TemporaryDirectory(prefix="loom-foldback-patch-")
    patch, digest = freeze(original, Path(hold.name))
    try:
        return _check_empty(original, patch, digest, python, timeout)
    finally:
        hold.cleanup()


def _check_empty(original: Path, patch: Path, digest: str, python: str, timeout: int) -> dict:
    files, err = _parse_or_error(patch, original, digest, False)
    if err:
        return err
    result = {"patch": portable(original), "patch_sha256": digest, "patch_frozen": True, "files": len(files),
              "additions_only": bool(files) and all(f["added"] for f in files),
              "tool_dirs": sorted({"/".join(f["path"].split("/")[:2]) for f in files}),
              "apply_check": None, "smoke": [], "status": None, "reason": "", "target_bound": False}
    with tempfile.TemporaryDirectory(prefix="loom-foldback-") as td:
        repo = Path(td)
        subprocess.run(["git", "init", "-q", str(repo)], check=True)
        chk = subprocess.run(["git", "-C", str(repo), "apply", "--check", str(patch)], capture_output=True, text=True)
        result["apply_check"] = chk.returncode == 0
        if chk.returncode != 0:
            result.update(status="fail", reason="git apply --check failed: " + chk.stderr.strip()[-400:])
            return result
        subprocess.run(["git", "-C", str(repo), "apply", str(patch)], check=True)
        smokes = sorted(repo.glob("tools/*/smoke.py"))
        if not smokes:
            result.update(status="fail", reason="no tools/<name>/smoke.py: the fold-back carries no executable control")
            return result
        for smoke in smokes:
            for flags in ([], ["-O"]):
                p = subprocess.run([python, "-E", "-s", *flags, str(smoke)], cwd=smoke.parent,
                                   capture_output=True, text=True, timeout=timeout)
                tail = (p.stdout.strip().splitlines() or [""])[-1][:300]
                err = p.stderr.strip().splitlines()[-1][:300] if p.stderr.strip() else ""
                result["smoke"].append({"smoke": str(smoke.relative_to(repo)), "optimized": bool(flags),
                                        "exit_code": p.returncode, "stdout_tail": tail, "stderr_tail": err})
    codes = [s["exit_code"] for s in result["smoke"]]
    missing = [s for s in result["smoke"] if "ModuleNotFoundError" in s["stderr_tail"]]
    if all(c == 0 for c in codes) and result["additions_only"]:
        result["status"] = "pass"
    elif missing:
        result.update(status="error", reason="smoke needs an uninstalled dependency: " + missing[0]["stderr_tail"])
    elif not result["additions_only"]:
        result.update(status="fail", reason="patch modifies existing files; a fold-back must be additions-only")
    else:
        result.update(status="fail", reason="smoke failed in at least one mode")
    return result
