"""Oracles: the instrument itself, asked again.

A rule induced from receipts is a guess about a tool. An oracle lets R2R test the guess the only honest way: build a
file the tool has never seen, predict the outcome, run the tool. Three kinds:

  CommandOracle   any program that follows the driver protocol (see drivers/blender_io.py): it is given a list of files
                  and writes one JSON verdict per line. If it dies, the death is charged to the file it was on and a new
                  process takes the rest.
  RuleOracle      a hidden rule plays the tool. This is how R2R is tested on itself: plant a known rule, hand the engine
                  only receipts, and see whether probing recovers the rule.
  FunctionOracle  a Python callable, for tests and for in-process instruments.

An oracle never grades anything. It reports pass, fail with a signature, or skip.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path


class Oracle:
    name = "oracle"

    def run(self, files: list[str], workdir: Path) -> dict[str, dict]:
        raise NotImplementedError


class FunctionOracle(Oracle):
    def __init__(self, name: str, fn):
        self.name, self.fn = name, fn

    def run(self, files, workdir):
        out = {}
        for f in files:
            outcome, signature = self.fn(f)
            out[f] = {"outcome": outcome, "signature": signature}
        return out


class RuleOracle(Oracle):
    """Fails, with one fixed signature, exactly the files a hidden rule fires on."""

    def __init__(self, name: str, rule, signature: str = "hidden rule fired"):
        self.name, self.rule, self.signature = name, rule, signature

    def run(self, files, workdir):
        from .events import Case
        out = {}
        for f in files:
            case = Case(f, Path(f).read_bytes())
            hit = self.rule.fires(case.sites)
            out[f] = {"outcome": "fail" if hit else "pass", "signature": self.signature if hit else ""}
        return out


class CommandOracle(Oracle):
    """argv is a list in which "{files}" and "{out}" are replaced by the list file and the verdict file."""

    def __init__(self, name: str, argv: list[str], timeout: float = 3600, max_restarts: int = 20, cwd: str | None = None):
        self.name, self.argv, self.timeout, self.max_restarts, self.cwd = name, list(argv), timeout, max_restarts, cwd
        self.calls = 0
        self.deaths: list[dict] = []

    def run(self, files, workdir):
        workdir = Path(workdir)
        workdir.mkdir(parents=True, exist_ok=True)
        todo = list(dict.fromkeys(files))
        out: dict[str, dict] = {}
        restarts = 0
        while todo:
            self.calls += 1
            lst = workdir / f"oracle-files-{self.calls:04d}.txt"
            res = workdir / f"oracle-verdicts-{self.calls:04d}.jsonl"
            lst.write_text("\n".join(todo) + "\n", encoding="utf-8")
            if res.exists():
                res.unlink()
            argv = [a.replace("{files}", str(lst)).replace("{out}", str(res)) for a in self.argv]
            try:
                proc = subprocess.run(argv, capture_output=True, text=True, timeout=self.timeout, cwd=self.cwd)
                code, tail = proc.returncode, (proc.stderr or "")[-400:]
            except subprocess.TimeoutExpired:
                code, tail = -9, "timed out"
            got = []
            if res.exists():
                for line in res.read_text(encoding="utf-8").splitlines():
                    try:
                        d = json.loads(line)
                    except ValueError:
                        continue
                    if d.get("file") in todo and d.get("outcome") in ("pass", "fail", "skip"):
                        out[d["file"]] = {k: d[k] for k in ("outcome", "signature", "seconds", "message") if k in d}
                        got.append(d["file"])
            rest = [f for f in todo if f not in out]
            if not rest:
                break
            # the driver stopped early: the file it was on takes the blame, the rest go to a new process
            victim = rest[0]
            out[victim] = {"outcome": "fail", "signature": f"instrument died (exit {code})", "message": tail}
            self.deaths.append({"file": victim, "exit": code, "stderr_tail": tail})
            todo = rest[1:]
            restarts += 1
            if restarts > self.max_restarts:
                for f in todo:
                    out[f] = {"outcome": "skip", "signature": "oracle gave up after repeated deaths"}
                break
        return out
