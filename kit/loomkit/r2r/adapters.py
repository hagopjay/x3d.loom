"""Adapters: each receipt family the Loom's repositories hold, turned into failure events.

    chaos        x3d-blender-io tools/chaos/differential.py output (rows.json + mutants/): importer and re-export crashes,
                 judge crashes, and, when asked, each judge's verdicts
    incidents    a JSONL file of failure events (the generic door: anything can write these)
    verdicts     a JSONL file of {file, outcome, signature} from one instrument run (what an oracle driver prints)
    zod          x3d.zod receipts: files where the generated Zod schema and the XSD disagree
    faultlab     the Fault Lab's planted faults and what the checks said before and after
    failures     loom.failure/1 records (render failures of the glTF lane)
    rejections   loom.rejection/1 records

An adapter never decides what a failure means. It copies who said what about which file, names the instrument with its
version, and keeps a pointer back to the row it read.
"""
from __future__ import annotations

import json
from pathlib import Path

from .events import Event, normalise_signature, read_events


def chaos(run_dir: Path, seeds_dir: Path, addon: str, runtime: str = "bpy", x3dpy: str = "x3d.py",
          split: str = "train", verdicts: bool = False, own: str = "", xsd: str = "xmllint + x3d-4.0.xsd",
          schematron: str = "X3D Schematron") -> list[Event]:
    """One differential chaos run. Every mutant has a twin: the seed it was cut from."""
    run_dir, seeds_dir = Path(run_dir), Path(seeds_dir)
    rows_path = run_dir / "rows.json"
    rows = json.loads(rows_path.read_text(encoding="utf-8"))
    imp_name = f"x3d-blender-io {addon} importer ({runtime})"
    exp_name = f"x3d-blender-io {addon} import then export ({runtime})"
    judge_names = {"x3dpy": x3dpy, "own": own or f"x3d-blender-io {addon} own validator", "xsd": xsd,
                   "schematron": schematron}
    out: list[Event] = []
    for i, r in enumerate(rows):
        f = run_dir / "mutants" / r["file"]
        twin = seeds_dir / r["seed"]
        common = dict(file=str(f), twin=str(twin), group=r["seed"], observed="tool", family="chaos-differential",
                      note=f"{r['op']}: {r['what']}"[:300], split=split, source={"path": str(rows_path), "row": i},
                      label=r["op"])
        imp = r.get("import", {})
        res = imp.get("result")
        if res == "FINISHED":
            out.append(Event(imp_name, "pass", **common))
        elif res:
            sig = imp.get("exception") or f"import returned {res}"
            out.append(Event(imp_name, "fail", signature=sig, **common))
        exp = r.get("reexport", {})
        if exp.get("result") == "FINISHED":
            out.append(Event(exp_name, "pass", **common))
        elif exp.get("result") == "EXCEPTION":
            out.append(Event(exp_name, "fail", signature=exp.get("exception") or "export raised", **common))
        for j in ("own", "x3dpy"):
            v = r.get(j)
            if v is None:
                continue
            name = judge_names[j] + " (does it crash?)"
            if "crash" in v:
                out.append(Event(name, "fail", signature=normalise_signature(str(v["crash"])), **common))
            else:
                out.append(Event(name, "pass", **common))
        if verdicts:
            for j in ("own", "x3dpy", "xsd", "schematron"):
                v = r.get(j)
                if v is None or v.get("valid") is None:
                    continue
                name = judge_names[j] + " (verdict)"
                if v["valid"]:
                    out.append(Event(name, "pass", **common))
                else:
                    errs = v.get("errors") or ["invalid, no message"]
                    out.append(Event(name, "fail", signature=normalise_signature(str(errs[0])), **common))
    return out


def chaos_seeds(seeds_dir: Path, instruments: list[str], split: str = "train") -> list[Event]:
    """The seeds themselves as passing events. Only call this for instruments that were RUN on the seeds and passed."""
    out = []
    for f in sorted(Path(seeds_dir).glob("*.x3d")):
        for inst in instruments:
            out.append(Event(inst, "pass", str(f), group=f.name, family="chaos-differential", split=split,
                             note="seed", label="seed"))
    return out


def incidents(path: Path) -> list[Event]:
    return read_events(Path(path))


def verdicts(path: Path, instrument: str, family: str = "oracle", split: str = "train", twin_of: dict | None = None,
             group_of: dict | None = None) -> list[Event]:
    """What an oracle driver wrote: one JSON object per line with file, outcome and (for a failure) signature."""
    out = []
    for n, line in enumerate(Path(path).read_text(encoding="utf-8").splitlines()):
        line = line.strip()
        if not line:
            continue
        d = json.loads(line)
        if d.get("outcome") not in ("pass", "fail"):
            continue                      # a skip is not a verdict about the file
        f = d["file"]
        out.append(Event(d.get("instrument", instrument), d["outcome"], f, d.get("signature", ""),
                         twin=(twin_of or {}).get(f) or d.get("twin"), group=(group_of or {}).get(f, d.get("group", "")),
                         family=family, split=split, note=d.get("note", ""), source={"path": str(path), "row": n},
                         label=d.get("label", "")))
    return out


def faultlab(demo_dir: Path, instrument: str = "Fault Lab author (planted faults, x3d.demo fault-lab/v1)") -> list[Event]:
    """The Fault Lab: ten faults planted by hand in one clean scene. Each fault is its own signature with the clean
    scene as twin. The failures are AUTHORED (a person says the file is wrong), not observed by a tool, and the
    events say so, which caps what grade a rule drawn from them can get."""
    demo_dir = Path(demo_dir)
    data = json.loads((demo_dir / "data" / "cases.json").read_text(encoding="utf-8"))
    clean = None
    for c in data["cases"]:
        if c.get("family") == "clean" or c["id"] == "clean":
            clean = demo_dir / c["scene"]
    out: list[Event] = []
    src = str(demo_dir / "data" / "cases.json")
    for i, c in enumerate(data["cases"]):
        scene = demo_dir / c["scene"]
        if c.get("family") == "clean" or c["id"] == "clean":
            out.append(Event(instrument, "pass", str(scene), group="clean", observed="authored", family="fault-lab",
                             note="the clean twin", source={"path": src, "row": i}))
        else:
            out.append(Event(instrument, "fail", str(scene), signature=f"planted fault: {c['id']}",
                             twin=str(clean) if clean else None, group=c["id"], observed="authored", family="fault-lab",
                             note=(c.get("title") or c["id"])[:200], source={"path": src, "row": i}, label=c.get("family", "")))
    return out


def faultlab_verdicts(demo_dir: Path, which: str = "before") -> dict:
    """What the validator said about each planted fault, before or after its fixes: {case id: bool flagged}, with the
    commit it ran at. Not events: a table to lay beside R2R's rules."""
    d = json.loads((Path(demo_dir) / "data" / f"checks-{which}.json").read_text(encoding="utf-8"))
    out = {}
    for cid, row in d["cases"].items():
        flagged = (not row.get("xsd", {}).get("valid", True)) or bool(row.get("semantic", {}).get("errors")) \
            or bool(row.get("shacl_core")) or bool(row.get("twin"))
        out[cid] = flagged
    return {"commit": d.get("x3d_mcp_commit"), "label": d.get("label"), "flagged": out}


def failures(path: Path, instrument_prefix: str = "") -> list[Event]:
    """loom.failure/1 records (the glTF lane's render failures). The subject is rarely an X3D file, so these usually
    serve as a count of what R2R cannot yet read rather than as input to induction."""
    path = Path(path)
    d = json.loads(path.read_text(encoding="utf-8"))
    rows = d if isinstance(d, list) else d.get("failures") or d.get("records") or []
    out = []
    for i, r in enumerate(rows):
        f = r.get("file") or r.get("subject") or r.get("scene") or ""
        f = str((path.parent / f)) if f and not Path(f).is_absolute() else f
        inst = (instrument_prefix + " " + str(r.get("tool") or r.get("instrument") or r.get("stage") or "unknown tool")).strip()
        out.append(Event(inst, "fail", f or str(path), signature=normalise_signature(str(r.get("reason") or r.get("error") or r.get("message") or r.get("code") or "failure")),
                         family="loom.failure/1", note=str(r.get("explained") or r.get("note") or "")[:200],
                         source={"path": str(path), "row": i}))
    return out
