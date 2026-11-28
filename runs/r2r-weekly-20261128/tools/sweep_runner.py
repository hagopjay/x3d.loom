#!/usr/bin/env python3
"""Sweep runner for the weekly R2R watch. It runs kit/loomkit/r2r/drivers/blender_io.py over a file list in shards
and survives a file that kills or hangs the driver: that file gets a row of its own and the shard carries on.

    python sweep_runner.py --python VENV/bin/python --driver .../drivers/blender_io.py --repo X3D_BLENDER_IO \
        --addon-source SRC --instrument import --files-from files.txt --out out.jsonl [--shards 4] [--deadline 60]

A file that gives no answer within --deadline seconds is recorded as
    {"outcome": "fail", "signature": "no answer in 60 s (sweep runner stopped the process)"}
and a file on which the process dies as
    {"outcome": "fail", "signature": "process died, exit <code>"}.
Rows are written to --out in the order of the file list. Standard library only.
"""
import argparse, json, os, subprocess, sys, tempfile, threading, time
from pathlib import Path


def run_shard(a, files, out_path, log):
    todo = list(files)
    rows = {}
    while todo:
        lst = Path(tempfile.mkstemp(prefix="sweep-", suffix=".txt")[1])
        lst.write_text("\n".join(todo) + "\n", encoding="utf-8")
        part = Path(tempfile.mkstemp(prefix="sweep-", suffix=".jsonl")[1])
        part.unlink()
        cmd = [a.python, a.driver, "--repo", a.repo, "--addon-source", a.addon_source, "--instrument", a.instrument,
               "--files-from", str(lst), "--out", str(part), "--mem-gb", str(a.mem_gb)]
        p = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        seen, last, t_start, verdict = 0, time.time(), time.time(), None
        while True:
            time.sleep(0.5)
            n = sum(1 for _ in open(part, encoding="utf-8")) if part.exists() else 0
            if n > seen:
                seen, last = n, time.time()
            rc = p.poll()
            if rc is not None:
                n = sum(1 for _ in open(part, encoding="utf-8")) if part.exists() else 0
                seen = n
                if rc != 0 or seen < len(todo):
                    verdict = f"process died, exit {rc}"
                break
            grace = a.startup if seen == 0 and time.time() - t_start < a.startup + a.deadline else 0
            if time.time() - last > a.deadline + grace:
                p.kill(); p.wait()
                verdict = f"no answer in {a.deadline} s (sweep runner stopped the process)"
                break
        got = [json.loads(l) for l in open(part, encoding="utf-8")] if part.exists() else []
        for r in got:
            rows[r["file"]] = r
        todo = todo[len(got):]
        if verdict and todo:
            f = todo.pop(0)
            rows[f] = {"file": f, "outcome": "fail", "signature": verdict, "seconds": round(time.time() - last, 1)}
            log(f"{a.instrument}: {verdict}: {f}")
        for q in (lst, part):
            try: q.unlink()
            except OSError: pass
    with open(out_path, "w", encoding="utf-8") as o:
        for f in files:
            o.write(json.dumps(rows[f]) + "\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    for k in ("python", "driver", "repo", "addon-source", "instrument", "files-from", "out"):
        ap.add_argument("--" + k, required=True)
    ap.add_argument("--shards", type=int, default=4)
    ap.add_argument("--deadline", type=int, default=60)
    ap.add_argument("--startup", type=int, default=30, help="extra seconds allowed before the first answer of a process")
    ap.add_argument("--mem-gb", type=float, default=10)
    a = ap.parse_args()
    files = [l.strip() for l in Path(a.files_from).read_text(encoding="utf-8").splitlines() if l.strip()]
    lock = threading.Lock()
    def log(m):
        with lock:
            print(time.strftime("%H:%M:%S"), m, flush=True)
    parts, threads = [], []
    for i in range(a.shards):
        chunk = files[i::a.shards]
        op = Path(f"{a.out}.shard{i}")
        parts.append((chunk, op))
        t = threading.Thread(target=run_shard, args=(a, chunk, op, log)); t.start(); threads.append(t)
    for t in threads:
        t.join()
    rows = {}
    for chunk, op in parts:
        for l in open(op, encoding="utf-8"):
            r = json.loads(l); rows[r["file"]] = r
        op.unlink()
    with open(a.out, "w", encoding="utf-8") as o:
        for f in files:
            o.write(json.dumps(rows[f]) + "\n")
    c = {}
    for r in rows.values():
        c[r["outcome"]] = c.get(r["outcome"], 0) + 1
    log(f"{a.instrument}: {len(rows)} files, {c}")


if __name__ == "__main__":
    main()
