"""loomkit command line. Exit 0 = passed; 1 = candidate contract violation (stable code on stdout, or a witness
record with status fail); 2 = instrument or input error (or a witness record with status error). Witness commands
write their record first and then exit by its status. Same convention as the Data City gate kit, and it survives `python -O`.

  python -m loomkit candidate ROOT
  python -m loomkit traps     ROOT --evidence DIR --files GLOB [--host strict]
  python -m loomkit grammar   ROOT --evidence DIR --files GLOB [--fork PATH]
  python -m loomkit foldback  ROOT --evidence DIR --patch FILE [--target REPO --base SHA --consumer CMD]
  python -m loomkit sci       ROOT --evidence DIR --profile kit/profiles/x3d-stem-science.json
  python -m loomkit play      ROOT --evidence DIR --tapes GLOB --levels GLOB --runner FILE [--repeats 2]
  python -m loomkit hepevent  ROOT --evidence DIR --events GLOB --spec FILE
  python -m loomkit physics   ROOT --evidence DIR --runs GLOB [--hosts chromium,firefox,webkit,node] [--max-waivers N] [--require-takeover]
  python -m loomkit command   ROOT --evidence DIR --name NAME -- CMD ...
  python -m loomkit record    ROOT --evidence DIR --name NAME --status not_run --reason TEXT [--origin reviewed --file F ...]
  python -m loomkit accept    ROOT --evidence DIR --profile FILE
  python -m loomkit receipt   ROOT --evidence DIR --profile FILE --subject TEXT --out FILE [--outputs F ...] [--prev FILE]
  python -m loomkit verify-receipt FILE
  python -m loomkit sweep     SRC DEST --rules kit/profiles/public-sweep.json
  python -m loomkit picture   REVIEW.json --subject SHA --frames FRAMES.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

from . import accept as acc
from . import foldback, grammar, hepevent, metalsite, pagetraps, physics, picture, play, receipt, rejection, sci, sweep, traps
from .core import GateError, InstrumentError, candidate, contained, need, portable, safe_name, sha256_file, write_witness


def _files(root: Path, pattern: str) -> list[Path]:
    """One glob, or several separated by commas ('app/*.js,app/*.html'). Every pattern must match something."""
    found: set[Path] = set()
    for pat in (x.strip() for x in pattern.split(",")):
        hit = {p for p in root.glob(pat) if p.is_file()}
        need(hit, "NO_FILES_MATCHED", pat)
        found |= hit
    return sorted(found)


def cmd_traps(a) -> dict:
    root = Path(a.root)
    subject = candidate(root)["sha256"]
    rows, errors, warnings, seen = {}, 0, 0, {"scenes": 0, "bytes": 0}
    for f in _files(root, a.files):
        data = f.read_bytes()
        seen["scenes"] += 1; seen["bytes"] += len(data)
        hits = traps.check(data, {"host": a.host})
        rows[f.relative_to(root).as_posix()] = [h.__dict__ for h in hits]
        errors += sum(h.severity == "error" for h in hits)
        warnings += sum(h.severity == "warning" for h in hits)
    status = "fail" if errors else "pass"
    return write_witness(a.evidence, root, subject, "traps", status, "C",
                         {"tool": "loomkit.traps", "rules": sorted(traps.RULES),
                          "rules_sha256": sha256_file(Path(traps.__file__))},
                         measurements={"files": len(rows), "errors": errors, "warnings": warnings, "seen": seen, "hits": rows},
                         coverage={"rules": len(traps.RULES)},
                         limitations=["Portable subset of x3d.onto loom_gate.py rules; the family gate itself is not on this machine.",
                                      "Runtime-labelled rules describe the runtime they were observed on."])


def cmd_pagetraps(a) -> dict:
    """Page traps over a study's JavaScript: the X_ITE runtime contracts the Loom has paid for (law 32)."""
    root = Path(a.root)
    subject = candidate(root)["sha256"]
    rows, errors, warnings, seen = {}, 0, 0, {"field_callbacks": 0, "world_loads": 0, "inline_scripts": 0, "sim_units": 0}
    for f in _files(root, a.files):
        text, rel = f.read_text(encoding="utf-8"), f.relative_to(root).as_posix()
        if f.suffix.lower() in (".html", ".htm"):
            hits, code = pagetraps.check_html(text, rel), pagetraps.scripts_view(text)
            seen["inline_scripts"] += len(pagetraps.inline_scripts(text))
            seen["sim_units"] += pagetraps.sim_units(text, html=True)
        else:
            hits, code = pagetraps.check(text, rel), text
            seen["sim_units"] += pagetraps.sim_units(text)
        for k, v in pagetraps.inventory(code).items():
            seen[k] += v
        rows[rel] = [h.__dict__ for h in hits]
        errors += sum(h.severity == "error" for h in hits)
        warnings += sum(h.severity == "warning" for h in hits)
    return write_witness(a.evidence, root, subject, "page-traps", "fail" if errors else "pass", "C",
                         {"tool": "loomkit.pagetraps", "rules": sorted(pagetraps.RULES), "rules_sha256": sha256_file(Path(pagetraps.__file__))},
                         measurements={"files": len(rows), "errors": errors, "warnings": warnings, "seen": seen, "hits": rows},
                         coverage={"rules": len(pagetraps.RULES)},
                         limitations=["Static pattern reading of page JavaScript; a clean result means none of these known traps is present, not that the page behaves correctly.",
                                      "Reads .js files and the inline <script> blocks of .html files listed in --files; 'seen' counts the field callbacks and world loads it read (zero means the X_ITE rules had nothing to judge), and sim_units, the files and inline scripts that declare // loom:sim (zero means sim-nonportable-math judged nothing: a deterministic simulation must be marked to be held to it).",
                                      "Rules are labelled with the runtime they were observed on (X_ITE 16.5.1 unless stated)."])


def cmd_grammar(a) -> list[dict]:
    root = Path(a.root)
    subject = candidate(root)["sha256"]
    files = _files(root, a.files)
    ident, results = grammar.validate(files, Path(a.fork))
    summ = {Path(k).relative_to(root).as_posix(): grammar.summarise(v) for k, v in results.items()}
    g_status = "pass" if all(s["xsd_valid"] and s["xsd_errors"] == 0 for s in summ.values()) else "fail"
    instrument_err = [k for k, s in summ.items() if s["semantic_instrument_error"]]
    if instrument_err:
        m_status = "error"
    else:
        m_status = "pass" if all(s["semantic_errors"] == 0 for s in summ.values()) else "fail"
    lim = [f"Fork commit {ident['commit'][:7]} on branch {ident['branch']}; not the family pin unless they match."]
    out = [write_witness(a.evidence, root, subject, "grammar", g_status, "C", ident,
                         measurements={k: {x: s[x] for x in ("xsd_valid", "xsd_errors", "xsd_version")} for k, s in summ.items()},
                         coverage={"files": len(summ)}, limitations=lim),
           write_witness(a.evidence, root, subject, "meaning", m_status, "C", ident,
                         measurements={k: {x: s[x] for x in ("semantic_errors", "semantic_warnings", "semantic_instrument_error")} for k, s in summ.items()},
                         coverage={"files": len(summ)}, limitations=lim,
                         reason="semantic checker raised on: " + ", ".join(instrument_err) if instrument_err else "")]
    return out


def cmd_foldback(a) -> dict:
    root = Path(a.root)
    subject = candidate(root)["sha256"]
    if a.target:
        need(a.base, "FOLDBACK_NEEDS_BASE", "--target needs --base SHA: the commit the patch is claimed to apply to")
        res = foldback.check_target(Path(a.patch), Path(a.target), a.base, a.consumer, scorer=a.scorer, impl=a.impl)
        where, lim = f"clean clone of {Path(a.target).name} at {res['base_sha'] or a.base}", [
            "The consumer command is the target's own regression; it shows the patch holds there, not that it helps a later task."]
    else:
        res = foldback.check(Path(a.patch))
        where, lim = "empty temporary repository", [
            "Applied to an empty repository only; compatibility with an existing checkout is not tested (target_bound: false).",
            "The smoke tests are the patch author's own code, not an independent consumer."]
    return write_witness(a.evidence, root, subject, "foldback", res["status"], "C",
                         {"tool": "loomkit.foldback", "git_apply": where, "python": portable(sys.executable)},
                         measurements=res, coverage={"modes": sorted({s["optimized"] for s in res["smoke"]}),
                                                     "target_bound": res["target_bound"],
                                                     "consumer": bool(res.get("consumer_after")),
                                                     "patch_frozen": bool(res.get("patch_frozen")),
                                                     # True only for a DECLARED scorer closure the patch leaves alone
                                                     "scorer_unchanged": res["target_bound"] and res.get("scorer_closure", {}).get("state") == "unchanged",
                                                     "scorer_closure": res.get("scorer_closure", {}).get("state", "unknown")},
                         limitations=lim, reason=res["reason"] if res["status"] != "pass" else "")


def cmd_sci(a) -> dict:
    """x3d.STEM science gates over loom.scientific-case/1 manifests; writes the 'science' witness."""
    root = Path(a.root)
    subject = candidate(root)["sha256"]
    profile = acc.load_profile(a.profile)
    need("science" in profile, "PROFILE_NOT_SCIENTIFIC", a.profile)
    try:
        res = sci.check_bank(root, profile)
        status, reason = "pass", ""
    except GateError as e:
        res, status, reason = {"rejected": e.code, "detail": e.detail}, "fail", f"{e.code}: {e.detail}"
    return write_witness(a.evidence, root, subject, "science", status, "C",
                         {"tool": "loomkit.sci (reconstructed SCI gates)", "rules_sha256": sha256_file(Path(sci.__file__)),
                          "profile": profile["name"]},
                         measurements=res, coverage={"kinds": len(res.get("kinds", []))},
                         limitations=["Reconstructed from GATES.md; the original governance patch was not delivered."],
                         reason=reason)


def cmd_metalsite(a) -> dict:
    """Metal-site witness over PDB-format structures or trajectories; writes the 'metal-site' witness."""
    root = Path(a.root)
    subject = candidate(root)["sha256"]
    need(Path(a.spec).resolve().is_relative_to(root.resolve()), "SITE_SPEC",
         "the spec must be a file inside the candidate, so the candidate hash covers its thresholds")
    spec = json.loads(Path(a.spec).read_text())
    files = _files(root, a.files)
    try:
        res = metalsite.check_files(files, spec)
        res = {portable(Path(k).relative_to(root)): v for k, v in res.items()}
        status, reason = "pass", ""
    except GateError as e:
        res, status, reason = {"rejected": e.code, "detail": e.detail}, "fail", f"{e.code}: {e.detail}"
    except Exception as e:  # an instrument crash is an error record, never a pass and never a missing record (law 19)
        res, status, reason = {"error": type(e).__name__, "detail": str(e)[:600]}, "error", f"{type(e).__name__}: {e}"
    sites = sum(v["inventory"]["metals_checked"] for v in res.values() if isinstance(v, dict) and "inventory" in v)
    declared = [s for s in spec.get("sites", []) if isinstance(s, dict)] if isinstance(spec, dict) else []
    coverage = {"files": len(files), "sites": sites,
                "class_declared": sum(bool(s.get("class")) for s in declared),
                "tau4_floor_declared": sum(s.get("tau4_min") is not None for s in declared),
                "min_intact_fraction": spec.get("min_intact_fraction", 1.0) if isinstance(spec, dict) else None}
    return write_witness(a.evidence, root, subject, a.name, status, "C",
                         {"tool": "loomkit.metalsite", "rules_sha256": sha256_file(Path(metalsite.__file__)),
                          "spec_sha256": sha256_file(Path(a.spec))},
                         measurements=res, coverage=coverage,
                         limitations=["PDB format only; distance windows are typical values (L), declared in the spec."],
                         reason=reason)


def cmd_hepevent(a) -> dict:
    """Hep-event plausibility witness (a demo witness) over event JSON files and the X3D scenes they name; writes 'hep-event'."""
    root = Path(a.root)
    subject = candidate(root)["sha256"]
    spec = json.loads(Path(a.spec).read_text())
    files = _files(root, a.events)
    try:
        res = hepevent.check_files(files, spec)
        res = {portable(Path(k).relative_to(root)): v for k, v in res.items()}
        status, reason = "pass", ""
    except GateError as e:
        res, status, reason = {"rejected": e.code, "detail": e.detail}, "fail", f"{e.code}: {e.detail}"
    inv = [v["inventory"] for v in res.values() if isinstance(v, dict) and "inventory" in v]
    return write_witness(a.evidence, root, subject, "hep-event", status, "C",
                         {"tool": "loomkit.hepevent", "rules_sha256": sha256_file(Path(hepevent.__file__)),
                          "spec_sha256": sha256_file(Path(a.spec))},
                         measurements=res,
                         coverage={"events": len(files), "scenes": sum(1 for i in inv if i["scene"]),
                                   "tracks": sum(i["tracks"] for i in inv), "towers": sum(i["towers"] for i in inv)},
                         limitations=["Demo plausibility only: loose physics tolerances, declared in the spec; no mass shell, resonance or calorimeter sum rule.",
                                      "Nothing is rendered and no GLSL is compiled here: the shader check proves the binding (shader, attributes, clock route), not the look."],
                         reason=reason)


def cmd_play(a) -> dict:
    """Play witness: every listed level has a tape that replays, deterministically, to its recorded finish."""
    root = Path(a.root)
    subject = candidate(root)["sha256"]
    tapes, levels, runner = _files(root, a.tapes), _files(root, a.levels), root / a.runner
    need(runner.is_file(), "PLAY_RUNNER_MISSING", a.runner)
    try:
        res = play.check(tapes, levels, runner, a.node, a.repeats)
        status, reason = "pass", ""
    except GateError as e:
        res, status, reason = {"rejected": e.code, "detail": e.detail}, "fail", f"{e.code}: {e.detail}"
    node_v = subprocess.run([a.node, "--version"], capture_output=True, text=True).stdout.strip()
    return write_witness(a.evidence, root, subject, "play", status, "C",
                         {"tool": "loomkit.play", "rules_sha256": sha256_file(Path(play.__file__)), "runner": a.runner,
                          "runner_sha256": sha256_file(runner), "node": node_v},
                         measurements=res, coverage={"tapes": len(tapes), "levels": len(levels)},
                         limitations=["Determinism is shown on the runner's JavaScript engine only; other engines need their own replay (the browser witness).",
                                      "A tape proves one way through a level, not that the level is fair, fun or free of shortcuts."],
                         reason=reason)


def cmd_physics(a) -> dict:
    """Physics witness: every run record carries its own proof (per-step hashes replayed on every named host,
    exact references, a takeover proof where an engine was replaced) and every excursion is on the record."""
    root = Path(a.root)
    subject = candidate(root)["sha256"]
    runs = _files(root, a.runs)
    hosts = [h for h in a.hosts.split(",") if h] if a.hosts else None
    try:
        res = physics.check(runs, root, required_hosts=hosts, max_waivers=a.max_waivers, require_takeover=a.require_takeover)
        status, reason = "pass", ""
    except GateError as e:
        res, status, reason = {"rejected": e.code, "detail": e.detail}, "fail", f"{e.code}: {e.detail}"
    return write_witness(a.evidence, root, subject, "physics", status, "C",
                         {"tool": "loomkit.physics", "rules_sha256": sha256_file(Path(physics.__file__)), "hosts": hosts or "as each record names them",
                          "max_waivers": a.max_waivers, "require_takeover": a.require_takeover},
                         measurements=res, coverage={"runs": len(res["runs"]) if "runs" in res else len(runs), "max_waivers": a.max_waivers, "waivers_total": res.get("waivers"), "require_takeover": bool(a.require_takeover)},
                         limitations=["Determinism is shown on the hosts and the machine the record names; another machine or another engine build needs its own replay (law 42).",
                                      "A passing record shows the run answers to its references and hashes; it does not show the engine's model is right where no exact reference exists.",
                                      "The witness reads the record a project's own harness wrote; the harness is trusted to have replayed what it says (the project's browser evidence is the behaviour witness)."],
                         reason=reason)


def cmd_command(a) -> dict:
    """Adapter for a project's own gate: exit 0 pass, 1 fail, anything else error."""
    root = Path(a.root)
    subject = candidate(root)["sha256"]
    cmd = a.cmd
    need(cmd, "NO_COMMAND", "give the project command after --")
    p = subprocess.run(cmd, cwd=root, capture_output=True, text=True, timeout=1800)
    status = {0: "pass", 1: "fail"}.get(p.returncode, "error")
    log = (p.stdout + "\n--- stderr ---\n" + p.stderr).encode()
    log_name = f"{safe_name(a.name)}.log"
    Path(a.evidence).mkdir(parents=True, exist_ok=True)
    (Path(a.evidence) / log_name).write_bytes(log)
    return write_witness(a.evidence, root, subject, a.name, status, "C",
                         {"tool": "project gate (adapter)", "command": cmd},
                         measurements={"exit_code": p.returncode, "stdout_tail": p.stdout.strip()[-600:]},
                         evidence=[{"path": log_name, "sha256": hashlib.sha256(log).hexdigest()}],
                         reason="" if status == "pass" else f"exit {p.returncode}")


def cmd_record(a) -> dict:
    """A hand-written record: origin `declared`, or `reviewed` when a person looked at named evidence files.
    It never carries grade C, and a profile admits its pass only where the rule names its origin (review 18 Nov 2026)."""
    root = Path(a.root)
    need(a.origin in ("declared", "reviewed"), "UNKNOWN_ORIGIN", a.origin)
    need(a.grade != "C", "DECLARED_NOT_MEASURED", f"{a.name}: `record` writes what a person says, so it cannot be grade C")
    evidence = []
    if a.origin == "reviewed":
        need(a.file, "REVIEW_NEEDS_EVIDENCE", f"{a.name}: --origin reviewed needs --file for what was looked at")
        ev = Path(a.evidence).resolve()
        for f in a.file:
            fp = Path(f).resolve()
            need(fp.is_file() and fp.is_relative_to(ev), "REVIEW_EVIDENCE_OUTSIDE", f"{f}: must be a file inside --evidence")
            evidence.append({"path": fp.relative_to(ev).as_posix(), "sha256": sha256_file(fp)})
    return write_witness(a.evidence, root, candidate(root)["sha256"], a.name, a.status, a.grade,
                         {"tool": a.origin, "by": a.by}, reason=a.reason, evidence=evidence, origin=a.origin)


def cmd_accept(a) -> dict:
    return acc.accept(a.root, a.evidence, acc.load_profile(a.profile))


def cmd_rejection(a) -> dict:
    """The record of a refusal: every required witness judged, each refusal with its class, reason and locus. Exit 0
    means the rejection was written; a candidate that would be accepted is refused with REJECTION_OF_ACCEPTED."""
    profile, profile_sha = acc.read_profile(a.profile)
    dest = Path(a.out)
    need(Path(a.evidence).resolve() not in dest.resolve().parents, "RECEIPT_INSIDE_EVIDENCE", f"{dest} is inside {a.evidence}; write it beside")
    if a.prev:
        rejection.verify(Path(a.prev))
    r = rejection.build(a.subject, a.root, a.evidence, profile, profile_sha, prev=Path(a.prev) if a.prev else None)
    rejection.write(r, dest)
    return {"rejection": str(dest), "refused": r["refused"], "failure_classes": r["failure_classes"], "sha256": r["sha256"]}


MANIFEST_SCHEMA = Path(__file__).resolve().parents[1] / "templates" / "evidence-manifest-v2.schema.json"


def manifest_path(dest: Path) -> Path:
    """The manifest is versioned WITH its receipt: receipt.json -> evidence-manifest.json (the v1 name, kept),
    receipt-v2.json -> receipt-v2.evidence-manifest.json. A successor never collides with its predecessor's manifest."""
    return dest.parent / ("evidence-manifest.json" if dest.name == "receipt.json" else f"{dest.stem}.evidence-manifest.json")


def check_manifest(m: dict) -> None:
    """Validate generated manifest bytes against the shipped v2 schema before anything is published (third review,
    18 Nov 2026, defect 10: a failed optional witness was written into not_run, whose enum excludes fail). jsonschema
    when installed; otherwise the same rules checked by hand, so CI without it still refuses a bad manifest."""
    schema = json.loads(MANIFEST_SCHEMA.read_text())
    try:
        import jsonschema
    except ImportError:
        jsonschema = None
    if jsonschema is not None:
        errs = sorted(jsonschema.Draft202012Validator(schema).iter_errors(m), key=lambda x: list(x.path))
        need(not errs, "MANIFEST_SCHEMA", "; ".join(f"{list(x.path)}: {x.message}" for x in errs[:3]))
        return
    errs = _schema_errors(schema, m, "$")   # the keywords this schema uses, all of them, so parity holds without jsonschema
    need(not errs, "MANIFEST_SCHEMA", "; ".join(errs[:3]))


def _schema_errors(s: dict, v, at: str) -> list:
    import re as _re
    out = []
    types = {"object": dict, "array": list, "string": str, "boolean": bool}
    ty = s.get("type")
    if ty == "integer":
        if not (isinstance(v, int) and not isinstance(v, bool)):
            return [f"{at}: not an integer"]
    elif ty and not isinstance(v, types[ty]):
        return [f"{at}: not {ty}"]
    if "const" in s and v != s["const"]:
        out.append(f"{at}: != {s['const']!r}")
    if "enum" in s and v not in s["enum"]:
        out.append(f"{at}: {v!r} not in {s['enum']}")
    if isinstance(v, str):
        if "pattern" in s and not _re.search(s["pattern"], v):
            out.append(f"{at}: does not match {s['pattern']}")
        if len(v) < s.get("minLength", 0):
            out.append(f"{at}: shorter than {s['minLength']}")
    if isinstance(v, int) and not isinstance(v, bool) and "minimum" in s and v < s["minimum"]:
        out.append(f"{at}: below {s['minimum']}")
    if isinstance(v, dict):
        out += [f"{at}.{k}: required" for k in s.get("required", []) if k not in v]
        for k, sub in s.get("properties", {}).items():
            if k in v:
                out += _schema_errors(sub, v[k], f"{at}.{k}")
    if isinstance(v, list) and "items" in s:
        for i, x in enumerate(v):
            out += _schema_errors(s["items"], x, f"{at}[{i}]")
    unknown = set(s) - {"$schema", "$id", "title", "description", "type", "required", "properties", "items", "const", "enum", "pattern", "minLength", "minimum"}
    if unknown:
        out.append(f"{at}: validator does not implement {sorted(unknown)}")
    return out


def _replace(src, dst):
    """os.replace, behind a name the transaction control can fault-inject."""
    import os
    os.replace(src, dst)


def cmd_receipt(a) -> dict:
    """Accept, then publish the receipt and its evidence manifest TOGETHER (third review, 18 Nov 2026, defect 9: the
    receipt was written, then the manifest collided and the command exited 1 with a new receipt beside an old manifest).
    Both destinations are checked first, both documents are built and validated in memory, both are staged as hidden
    temp files in the destination folder, and only then are they renamed into place; a failure removes what this run
    staged or placed and nothing else."""
    import os, tempfile as _tf
    profile, profile_sha = acc.read_profile(a.profile)   # one read: the bytes evaluated are the bytes attested
    # ONE candidate generation is judged and published (final external scan, 18 Nov 2026, defect 2: accept() hashed A,
    # then candidate() hashed B after a concurrent edit, and the receipt named both). The tree is hashed again just
    # before anything is placed; a change in between is refused.
    cand = candidate(a.root)
    result = acc.accept(a.root, a.evidence, profile, subject=cand)
    dest = Path(a.out)
    mpath = manifest_path(dest)
    ev_root = Path(a.evidence).resolve()
    for d in (dest, mpath):
        need(a.force or not d.exists(), "RECEIPT_EXISTS", f"{d} exists; write a new version or pass --force")
        # a receipt or manifest inside the evidence folder would inventory itself (or its predecessor) and be stale
        # the moment it is placed (fourth review, defect 10)
        need(ev_root not in d.resolve().parents, "RECEIPT_INSIDE_EVIDENCE", f"{d} is inside {a.evidence}; publish beside it")
    if a.prev:
        try:
            json.loads(Path(a.prev).read_bytes())
        except ValueError:
            raise GateError("PREV_NOT_RECEIPT", f"{a.prev} is not JSON, so it cannot be a receipt")
        receipt.verify(Path(a.prev))   # a predecessor must be a receipt that verifies, not any file
    visible = []
    for name in profile.get("visible_not_run", []):
        p = Path(a.evidence) / f"{name}.json"
        if not p.exists():
            visible.append({"witness": name, "status": "not_run", "reason": "no record"})
            continue
        try:
            rec = json.loads(p.read_text())
        except (OSError, ValueError) as e:
            visible.append({"witness": name, "status": "error", "reason": f"unreadable record: {e}"})
            continue
        why = acc.binding_problem(rec, name, cand["sha256"], Path(a.evidence))
        if why:   # never project another candidate's (or a drifted) result onto this one
            visible.append({"witness": name, "status": "stale", "reason": why})
            continue
        visible.append({"witness": name, "status": rec.get("status", "error"), "reason": rec.get("reason") or f"recorded {rec.get('status')} with no reason"})
    tools = {}
    for row in result["witnesses"]:
        rec = json.loads((Path(a.evidence) / f"{row['witness']}.json").read_text())
        tools[row["witness"]] = {k: rec["instrument"][k] for k in ("tool", "commit", "rules_sha256", "kit_sha256", "kit_commit", "kit_dirty") if k in rec["instrument"]}
    r = receipt.build(a.subject, result, cand["files"], [Path(o) for o in a.outputs], tools,
                      inputs={"candidate_sha256": cand["sha256"], "profile_sha256": profile_sha},
                      not_run=visible, model_calls=[],
                      budget={"paid_calls": 0, "cloud_resources": 0}, prev=Path(a.prev) if a.prev else None,
                      limitations=profile.get("limitations", []))
    rbytes = (json.dumps(r, sort_keys=True, indent=2) + "\n").encode()
    ev = Path(a.evidence)
    roles = {".json": "witness-record", ".log": "log", ".png": "frame", ".jpg": "frame", ".wav": "audio"}
    manifest = {"schema": "loom.evidence-manifest/2", "subject": a.subject, "candidate_sha256": cand["sha256"],
                "profile": profile["name"], "profile_sha256": profile_sha,
                "receipt": {"path": dest.name, "sha256": hashlib.sha256(rbytes).hexdigest()},
                "files": [{"path": p.relative_to(ev).as_posix(), "sha256": sha256_file(p), "bytes": p.stat().st_size,
                           "role": roles.get(p.suffix, "other")} for p in sorted(ev.rglob("*")) if p.is_file()],
                "not_run": [n for n in visible if n["status"] not in ("pass", "fail")],
                "failed": [n for n in visible if n["status"] == "fail"]}
    check_manifest(manifest)
    mbytes = (json.dumps(manifest, sort_keys=True, indent=2) + "\n").encode()
    # every accepted record and every file it cites must be inside the evidence folder AND in this manifest (defect 9)
    listed = {f["path"] for f in manifest["files"]}
    for row in result["witnesses"]:
        rec_rel = f"{row['witness']}.json"
        need(rec_rel in listed, "EVIDENCE_OUTSIDE_BUNDLE", f"{rec_rel} is not in the evidence inventory")
        for item in json.loads(contained(ev, rec_rel).read_text()).get("evidence", []):
            need(contained(ev, item["path"]).relative_to(ev.resolve()).as_posix() in listed, "EVIDENCE_OUTSIDE_BUNDLE", f"{item['path']} is not in the evidence inventory")
    need(candidate(a.root)["sha256"] == cand["sha256"], "CANDIDATE_CHANGED_DURING_RECEIPT",
         f"the tree changed while the receipt was being built (judged {cand['sha256'][:12]})")
    dest.parent.mkdir(parents=True, exist_ok=True)
    staged, placed, backups = [], [], {}
    try:
        for final, data in ((dest, rbytes), (mpath, mbytes)):
            fd, tmp = _tf.mkstemp(prefix="." + final.name + ".", suffix=".staged", dir=final.parent)
            with os.fdopen(fd, "wb") as fh:
                fh.write(data)
            staged.append((Path(tmp), final))
        for tmp, final in staged:
            need(a.force or not final.exists(), "RECEIPT_EXISTS", f"{final} appeared while staging")
            if final.exists():   # --force: copy the original aside; the atomic replace below leaves it in place until then
                fd, bak = _tf.mkstemp(prefix="." + final.name + ".", suffix=".backup", dir=final.parent)
                with os.fdopen(fd, "wb") as fh:
                    fh.write(final.read_bytes())
                backups[final] = Path(bak)
            _replace(tmp, final)
            placed.append(final)
    except BaseException:
        for tmp, final in staged:
            if tmp.exists():
                tmp.unlink()
        for final in placed:          # only the files this run replaced are touched: originals come back, new ones go
            if final in backups:
                os.replace(backups.pop(final), final)
            elif final.exists():
                final.unlink()
        for bak in backups.values():  # a file never replaced still holds its original; drop the spare copy
            bak.unlink()
        raise
    for bak in backups.values():
        bak.unlink()
    return {"receipt": str(dest), "sha256": r["sha256"], "candidate_sha256": r["candidate_sha256"],
            "profile_sha256": profile_sha, "evidence_manifest": str(mpath), "evidence_files": len(manifest["files"]),
            "visible_failed": [n["witness"] for n in manifest["failed"]]}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="loomkit")
    sub = ap.add_subparsers(dest="cmd_name", required=True)

    def common(name):
        p = sub.add_parser(name)
        p.add_argument("root")
        p.add_argument("--evidence", required=True)
        return p

    sub.add_parser("candidate").add_argument("root")
    p = common("traps"); p.add_argument("--files", required=True); p.add_argument("--host", default="")
    p = common("pagetraps"); p.add_argument("--files", required=True)
    p = common("grammar"); p.add_argument("--files", required=True); p.add_argument("--fork", default=str(grammar.DEFAULT_FORK))
    p = common("foldback"); p.add_argument("--patch", required=True)
    p.add_argument("--target", default=""); p.add_argument("--base", default=""); p.add_argument("--consumer", default="")
    p.add_argument("--scorer", action="append", default=[], help="glob (repeatable) of the oracle closure in the target: scorer code, helpers, expected data, config")
    p.add_argument("--impl", action="append", default=[], help="glob (repeatable) of files the patch may change; anything else makes the closure unknown")
    p = common("sci"); p.add_argument("--profile", required=True)
    p = common("metalsite"); p.add_argument("--files", required=True); p.add_argument("--spec", required=True)
    p.add_argument("--name", default="metal-site")
    p = common("hepevent"); p.add_argument("--events", required=True); p.add_argument("--spec", required=True)
    p = common("physics"); p.add_argument("--runs", required=True); p.add_argument("--hosts", default="")
    p.add_argument("--max-waivers", type=int, default=0); p.add_argument("--require-takeover", action="store_true")
    p = common("play"); p.add_argument("--tapes", required=True); p.add_argument("--levels", required=True)
    p.add_argument("--runner", required=True); p.add_argument("--node", default="node"); p.add_argument("--repeats", type=int, default=2)
    p = common("command"); p.add_argument("--name", required=True)
    p = common("record"); p.add_argument("--name", required=True); p.add_argument("--status", required=True)
    p.add_argument("--grade", default="L"); p.add_argument("--reason", required=True); p.add_argument("--by", default="operator")
    p.add_argument("--origin", default="declared"); p.add_argument("--file", nargs="*", default=[])
    p = common("accept"); p.add_argument("--profile", required=True)
    p = common("receipt"); p.add_argument("--profile", required=True); p.add_argument("--subject", required=True)
    p.add_argument("--out", required=True); p.add_argument("--outputs", nargs="*", default=[])
    p.add_argument("--prev"); p.add_argument("--force", action="store_true")
    p = common("rejection"); p.add_argument("--profile", required=True); p.add_argument("--subject", required=True)
    p.add_argument("--out", required=True); p.add_argument("--prev")
    sub.add_parser("verify-rejection").add_argument("file")
    sub.add_parser("verify-receipt").add_argument("file")
    p = sub.add_parser("sweep"); p.add_argument("src"); p.add_argument("dest"); p.add_argument("--rules", required=True)
    p.add_argument("--exclude", nargs="*", default=[".git", ".scratch", ".work", "__pycache__", "public-sweep.json"])
    p = sub.add_parser("picture"); p.add_argument("review"); p.add_argument("--subject", required=True); p.add_argument("--frames", required=True)

    argv = list(sys.argv[1:] if argv is None else argv)
    tail = []
    if "--" in argv:  # everything after "--" is the project command for `command`
        i = argv.index("--"); argv, tail = argv[:i], argv[i + 1:]
    a = ap.parse_args(argv)
    a.cmd = tail
    try:
        if a.cmd_name == "candidate":
            c = candidate(a.root); out = {"sha256": c["sha256"], "files": len(c["files"])}
        elif a.cmd_name == "verify-receipt":
            r = receipt.verify(Path(a.file)); out = {"receipt": "intact", "sha256": r["sha256"]}
        elif a.cmd_name == "verify-rejection":
            r = rejection.verify(Path(a.file)); out = {"rejection": "intact", "sha256": r["sha256"], "refused": r["refused"]}
        elif a.cmd_name == "sweep":
            rules = sweep.load_rules(Path(a.rules)); rules["_path"] = a.rules
            out = sweep.sweep(Path(a.src), Path(a.dest), rules, set(a.exclude))
            (Path(out["placed"]) / "SWEEP-REPORT.json").write_text(json.dumps({k: v for k, v in out.items()}, indent=2, sort_keys=True) + "\n")
            need(out["status"] == "pass", "LEAK_RESIDUE", json.dumps(out["residue"][:5]))
        elif a.cmd_name == "picture":
            out = picture.validate(json.loads(Path(a.review).read_text()), a.subject, json.loads(Path(a.frames).read_text()))
        else:
            out = {"sci": cmd_sci, "metalsite": cmd_metalsite, "hepevent": cmd_hepevent, "play": cmd_play, "physics": cmd_physics, "pagetraps": cmd_pagetraps, "traps": cmd_traps, "grammar": cmd_grammar, "foldback": cmd_foldback, "command": cmd_command,
                   "record": cmd_record, "accept": cmd_accept, "receipt": cmd_receipt, "rejection": cmd_rejection}[a.cmd_name](a)
    except GateError as e:
        print(json.dumps({"rejected": e.code, "detail": e.detail}))
        return 1
    except (InstrumentError, OSError, ValueError, KeyError, subprocess.SubprocessError) as e:
        print(json.dumps({"error": type(e).__name__, "detail": str(e)[:600]}))
        return 2
    except Exception as e:  # a bug in a witness is an instrument error (exit 2), never a violation (exit 1, law 19)
        print(json.dumps({"error": "INSTRUMENT_CRASH", "detail": f"{type(e).__name__}: {e}"[:600]}))
        return 2
    def brief(o):  # a witness record prints as its name and status; anything else prints whole
        return {"witness": o["witness"], "status": o["status"], "reason": o["reason"]} if "schema" in o and "witness" in o else o
    print(json.dumps([brief(o) for o in out] if isinstance(out, list) else brief(out), indent=2, default=str))
    return witness_exit(out)


def witness_exit(out) -> int:
    """Exit status follows the records written (review 18 Nov 2026, defect 1: `traps` printed status=fail and exited 0,
    so CI and `set -e` scripts read a failed check as success). Evidence is written first; then any `error` record
    exits 2 (instrument), any `fail` exits 1 (violation), and everything else, including not_run, exits 0."""
    recs = [o for o in (out if isinstance(out, list) else [out]) if isinstance(o, dict) and "schema" in o and "witness" in o]
    statuses = {o["status"] for o in recs}
    return 2 if "error" in statuses else 1 if "fail" in statuses else 0
