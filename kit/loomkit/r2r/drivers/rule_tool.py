"""A stand-in instrument: it fails exactly the files a given rule fires on. The shortest complete oracle driver.

    python3 -I rule_tool.py --rule '{"kind": "attr", "all": ["v:bool_noncanonical", "at:Box@solid"]}' \
            --files-from LIST.txt --out VERDICTS.jsonl [--signature TEXT]
    python3 -I rule_tool.py --rule none ...          a tool with the defect fixed: it passes everything

THE DRIVER PROTOCOL (all an instrument has to do to be probed by R2R):
  read    --files-from: one path per line
  write   --out: one JSON object per line, in the same order, flushed after each file:
            {"file": PATH, "outcome": "pass" | "fail" | "skip", "signature": TEXT for a failure, "seconds": N}
  die     if the instrument takes the process down, just die: R2R charges the death to the first file without a
          verdict and starts a new process for the rest

A signature names the kind of failure with the specifics stripped: an exception type and where it was raised, a
validator's rule id. Two failures with the same root cause should get the same signature.

This driver is used by the kit's tests and is not evidence about any real tool.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from loomkit.r2r.events import Case  # noqa: E402
from loomkit.r2r.rule import Rule  # noqa: E402


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rule", required=True)
    ap.add_argument("--signature", default="hidden rule fired")
    ap.add_argument("--files-from", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    rule = None if a.rule == "none" else Rule.from_json(json.loads(a.rule))
    files = [l for l in Path(a.files_from).read_text(encoding="utf-8").splitlines() if l.strip()]
    with open(a.out, "w", encoding="utf-8") as out:
        for f in files:
            t0 = time.time()
            try:
                case = Case(f, Path(f).read_bytes())
            except OSError as exc:
                row = {"file": f, "outcome": "skip", "signature": f"cannot read: {type(exc).__name__}"}
            else:
                hit = rule is not None and rule.fires(case.sites)
                row = {"file": f, "outcome": "fail" if hit else "pass", "signature": a.signature if hit else ""}
            row["seconds"] = round(time.time() - t0, 4)
            out.write(json.dumps(row) + "\n")
            out.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
