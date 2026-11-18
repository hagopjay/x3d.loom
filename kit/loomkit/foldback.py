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

from .core import portable, sha256_file


def patch_files(patch: Path) -> list[dict]:
    """List target files and whether each is an addition (old side /dev/null)."""
    text = patch.read_text(encoding="utf-8", errors="replace")
    if re.search(r"^diff --git ", text, re.M):  # git patches: one header per file, binary entries included
        out = []
        for block in re.split(r"^(?=diff --git )", text, flags=re.M)[1:]:
            head = block.split("\n@@", 1)[0].split("GIT binary patch", 1)[0]
            name = re.match(r"diff --git a/\S+ b/(\S+)", block).group(1)
            out.append({"path": name, "added": "new file mode" in head})
        return out
    out = []
    old = None
    for line in text.splitlines():
        if line.startswith("--- "):
            old = line[4:].strip()
        elif line.startswith("+++ ") and old is not None:
            new = re.sub(r"^b/", "", line[4:].strip())
            out.append({"path": new, "added": old == "/dev/null"})
            old = None
    if not out:  # binary-only git patches carry no ---/+++ pairs
        for m in re.finditer(r"^diff --git a/(\S+) b/(\S+)\n(new file mode)?", text, re.M):
            out.append({"path": m.group(2), "added": bool(m.group(3))})
    return out


def _run(cmd: list[str], cwd: Path, timeout: int) -> dict:
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    return {"exit_code": p.returncode, "stdout_tail": (p.stdout.strip().splitlines() or [""])[-1][:300],
            "stderr_tail": (p.stderr.strip().splitlines() or [""])[-1][:300]}


def check_target(patch: Path, target: Path, base: str, consumer: str, timeout: int = 900) -> dict:
    """Apply a fold-back patch to a clean clone of the real target at `base`; run the consumer's command before and after."""
    patch, target = Path(patch).resolve(), Path(target).resolve()
    files = patch_files(patch)
    result = {"patch": portable(patch), "patch_sha256": sha256_file(patch), "files": len(files),
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
    with tempfile.TemporaryDirectory(prefix="loom-foldback-target-") as td:
        repo = Path(td) / "t"
        subprocess.run(["git", "clone", "-q", "--no-hardlinks", "--no-checkout", str(target), str(repo)], check=True)
        subprocess.run(["git", "-C", str(repo), "checkout", "-q", "--detach", result["base_sha"]], check=True)
        head = subprocess.run(["git", "-C", str(repo), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
        if head != result["base_sha"]:
            result.update(status="error", reason=f"clone is at {head}, not {result['base_sha']}")
            return result
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
        result["consumer_after"] = _run(cmd, repo, timeout)
        for smoke in sorted(repo.glob("tools/*/smoke.py")):
            if any(f["path"] == smoke.relative_to(repo).as_posix() for f in files):
                for flags in ([], ["-O"]):
                    r = _run([sys.executable, "-E", "-s", *flags, str(smoke)], smoke.parent, timeout)
                    result["smoke"].append({"smoke": smoke.relative_to(repo).as_posix(), "optimized": bool(flags), **r})
    before, after = result["consumer_before"]["exit_code"], result["consumer_after"]["exit_code"]
    result["outcome"] = {(0, 0): "held", (1, 0): "improved"}.get((min(before, 1), after), "regressed" if before == 0 else "still failing")
    if after != 0:
        result.update(status="fail", reason=f"consumer exits {after} after the patch (before: {before}): {result['outcome']}")
    elif any(s["exit_code"] != 0 for s in result["smoke"]):
        result.update(status="fail", reason="the patch's own smoke failed on the target")
    else:
        result["status"] = "pass"
    return result


def check(patch: Path, python: str = sys.executable, timeout: int = 900) -> dict:
    patch = Path(patch).resolve()
    files = patch_files(patch)
    result = {"patch": portable(patch), "patch_sha256": sha256_file(patch), "files": len(files),
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
