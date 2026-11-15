#!/usr/bin/env python3
"""Corpus run: every .x3d under the given roots -> XSD verdict (x3d_mcp), JSON via xml2json,
then verdicts from x3d_mcp validate_json (jsonschema), ajv and Zod; writes receipts/corpus.json."""
import json, subprocess, sys, time, hashlib, os
from pathlib import Path
here = Path(__file__).resolve().parent
sys.path.insert(0, str(here))
MCP = Path(os.environ.get("X3D_MCP_SRC", "/home/user/x3d_mcp/src"))
sys.path.insert(0, str(MCP))
from validation.validate import validate_xml, validate_json   # noqa: E402
import xml2json                                              # noqa: E402

roots = [Path(p) for p in sys.argv[2:]] or [Path("/home/user")]
scratch = Path(sys.argv[1]); scratch.mkdir(parents=True, exist_ok=True)
MAXB = 2_000_000
files = []
for r in roots:
    for p in r.rglob("*.x3d"):
        if "node_modules" in p.parts or "/vendor/" in str(p) or p.stat().st_size > MAXB: continue
        files.append(p)
files.sort()


def one(args):
    i, p = args
    key = f"{i:05d}.json"
    row = {"src": str(p).removeprefix("/home/user/"), "bytes": p.stat().st_size}
    try:
        xml = p.read_bytes()
        row["xsd"] = bool(validate_xml(xml.decode("utf-8", "replace"))["valid"])
        doc, un = xml2json.xml_to_json(xml)
        row["unplaced"] = len(un); row["unplaced_ex"] = un[:3]
        try:
            txt = json.dumps(doc, allow_nan=False)
        except ValueError:          # NaN/Infinity in a field value is not JSON: strict parsers never see the document
            row["nonfinite"] = True
            txt = json.dumps(doc)
        (scratch / key).write_text(txt)
        t = time.perf_counter(); r = validate_json(txt); row["py"] = bool(r["valid"])
        row["pyMs"] = round((time.perf_counter() - t) * 1000, 3); row["pyErr"] = [e[:300] for e in r["errors"][:2]]
    except Exception as e:
        row["convert_error"] = f"{type(e).__name__}: {str(e)[:120]}"
    return key, row


if __name__ == "__main__":
    from multiprocessing import Pool
    t0 = time.time()
    with Pool(os.cpu_count()) as pool:
        rows = dict(pool.imap_unordered(one, list(enumerate(files)), chunksize=8))
    rows = dict(sorted(rows.items()))
    node = subprocess.run(["node", str(here / "validate-dir.mjs"), str(scratch)], capture_output=True, text=True, cwd=here.parent)
    if node.returncode:
        print(node.stderr, file=sys.stderr); sys.exit(1)
    for k, v in json.loads(node.stdout).items():
        rows[k].update(v)
    (here.parent / "receipts").mkdir(exist_ok=True)
    (here.parent / "receipts/corpus.json").write_text(json.dumps({"files": len(files), "seconds": round(time.time() - t0, 1), "rows": rows}, indent=1))
    print(len(files), "files", round(time.time() - t0, 1), "s")
