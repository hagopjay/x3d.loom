#!/usr/bin/env python3
"""receipts/corpus.json -> receipts/corpus-summary.json (+ stdout tables): agreement, XSD cross-tab, timings."""
import json, statistics as st, collections
from pathlib import Path
R = Path(__file__).resolve().parent.parent / "receipts"
data = json.loads((R / "corpus.json").read_text())
rows = list(data["rows"].values())
conv = [r for r in rows if "convert_error" not in r and not r.get("parseError") and "zod" in r]
bad = [r for r in rows if r not in conv]
agree3 = [r for r in conv if r["zod"] == r["ajv"] == r["py"]]
dis = [r for r in conv if not (r["zod"] == r["ajv"] == r["py"])]
xt = collections.Counter((r["xsd"], r["zod"]) for r in conv)
med = lambda k: round(st.median([r[k] for r in conv if k in r]), 3)
p95 = lambda k: round(sorted(r[k] for r in conv if k in r)[int(.95 * len(conv))], 3)
reasons = collections.Counter()
for r in conv:
    if r["xsd"] and not r["zod"]:
        e = (r.get("pyErr") or ["?"])[0]
        reasons[e.split(":")[0].rsplit("/", 1)[-1] + " :: " + (e.split(":", 1)[1][:70] if ":" in e else "")] += 1
summary = {
    "files": data["files"], "converted_and_checked": len(conv), "not_checked": len(bad),
    "not_checked_reasons": dict(collections.Counter(("convert_error" if "convert_error" in r else "nonjson" if r.get("parseError") else "other") for r in bad)),
    "three_way_agreement": len(agree3), "disagreements": [(r["src"], r.get("zod"), r.get("ajv"), r.get("py")) for r in dis][:20],
    "xsd_vs_zod": {f"xsd={k[0]},zod={k[1]}": v for k, v in sorted(xt.items())},
    "median_ms": {"zod": med("zodMs"), "ajv": med("ajvMs"), "jsonschema": med("pyMs")},
    "p95_ms": {"zod": p95("zodMs"), "ajv": p95("ajvMs"), "jsonschema": p95("pyMs")},
    "converter_unplaced_files": sum(1 for r in conv if r.get("unplaced")),
    "xsd_valid_but_json_rejected_top": reasons.most_common(12),
    "nonfinite_numbers": sum(1 for r in rows if r.get("nonfinite")),
}
(R / "corpus-summary.json").write_text(json.dumps(summary, indent=1) + "\n")
print(json.dumps(summary, indent=1))
