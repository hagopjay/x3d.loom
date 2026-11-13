#!/usr/bin/env python3
"""Second validator: run the user's x3d_mcp fork (XSD + semantic checks) over bridge scenes.

Usage (from bridge/):
  ~/Projects/x3d/x3d_mcp/.venv/bin/python -I scripts/validate-with-x3d-mcp.py [--x3d-mcp DIR] [--out FILE] FILE...
Files may be .x3d or experiment .zip packages (their x3d/scene.x3d member is checked).
Writes a JSON record (default validation/x3d-mcp-results.json). Exit 1 if any scene fails.
"""
import argparse, hashlib, json, re, sys, zipfile
from datetime import datetime, timezone
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("files", nargs="+")
ap.add_argument("--x3d-mcp", default=str(Path.home() / "Projects/x3d/x3d_mcp"))
ap.add_argument("--out", default="validation/x3d-mcp-results.json")
args = ap.parse_args()

src = Path(args.x3d_mcp) / "src"
sys.path.insert(0, str(src))
from validation.validate import validate_xml  # noqa: E402
from validation.semantic import validate_semantic  # noqa: E402

MAX_ZIP_MEMBER = 5_000_000


def scenes(path: Path):
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as z:
            info = z.getinfo("x3d/scene.x3d")
            if info.file_size > MAX_ZIP_MEMBER:
                raise ValueError("scene member too large")
            yield f"{path}!x3d/scene.x3d", z.read(info).decode("utf-8")
    else:
        yield str(path), path.read_text("utf-8")


def semantic_summary(report: str):
    """x3d_mcp's report opens with 'Found N error(s), M warning(s), K info(s)' (or says no issues)."""
    m = re.search(r"Found (\d+) error\(s\), (\d+) warning\(s\)(?:, (\d+) info\(s\))?", report)
    errors, warnings, infos = (int(m.group(1)), int(m.group(2)), int(m.group(3) or 0)) if m else (0, 0, 0)
    if not m and not re.search(r"no (semantic )?issues|passed", report, re.I):
        raise ValueError("unrecognised semantic report format: " + report[:200])
    items = re.findall(r"^- \*\*\[([a-z0-9-]+)\]\*\*", report, re.M)
    return {"errors": errors, "warnings": warnings, "infos": infos,
            "codes": {c: items.count(c) for c in sorted(set(items))}}


records, failed = [], 0
for f in args.files:
    p = Path(f).expanduser()
    for label, text in scenes(p):
        schema = validate_xml(text)
        sem = validate_semantic(text)
        s = semantic_summary(sem)
        ok = schema["valid"] and s["errors"] == 0
        failed += not ok
        records.append({
            "scene": label.replace(str(Path.home()), "~"),
            "sha256": hashlib.sha256(text.encode()).hexdigest(),
            "xsd": {k: schema.get(k) for k in ("valid", "schema_version", "errors", "notes") if k in schema},
            "semantic": s,
            "semanticReport": sem,
            "pass": ok,
        })
        print(f"{'PASS' if ok else 'FAIL'} {label}  xsd={schema['valid']} ({schema.get('schema_version')}) semantic errors={s['errors']} warnings={s['warnings']}")

out = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "validator": "x3d_mcp fork (validation.validate.validate_xml + validation.semantic.validate_semantic)",
    "x3dMcpPath": str(Path(args.x3d_mcp)).replace(str(Path.home()), "~"),
    "passed": len(records) - failed, "failed": failed, "records": records,
}
Path(args.out).write_text(json.dumps(out, indent=2))
sys.exit(1 if failed else 0)
