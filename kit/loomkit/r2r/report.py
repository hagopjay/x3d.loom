"""REPORT.md for a sealed run: the same facts as the JSON, laid out for a person who has to decide what to promote."""
from __future__ import annotations

import json
from pathlib import Path

WORD = {"C": "Confirmed", "L": "Likely", "S": "Suspected"}


def _n(a, b) -> str:
    return f"{a} of {b}" if b else "none to test"


def _rule_text(rule: dict) -> str:
    body = " & ".join(rule["all"])
    if rule.get("any"):
        body += (" & " if body else "") + f"(one of {len(rule['any'])} places)"
    return f"{rule['kind']}[{body}]"


def claim_of(doc: dict, instrument: str, signature: str) -> dict:
    """The candidate as it stands for one cluster. A rule that explains two signatures is one file with two claims,
    each with its own proof and grade; this returns the candidate seen through the claim for this cluster."""
    if doc["instrument"] == instrument and doc["signature"] == signature:
        return doc
    for extra in doc.get("also_explains", []):
        if extra["instrument"] == instrument and extra["signature"] == signature:
            return {**doc, **extra}
    return doc


def write_report(run_dir: Path) -> Path:
    run_dir = Path(run_dir)
    run = json.loads((run_dir / "run.json").read_text(encoding="utf-8"))
    clusters = json.loads((run_dir / "clusters.json").read_text(encoding="utf-8"))
    cands = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in sorted((run_dir / "candidates").glob("*.json"))}
    L: list[str] = []
    w = L.append
    w(f"# R2R run: {run.get('title') or run_dir.name}")
    w("")
    w(f"Made {run['created_utc']} by loomkit.r2r {run['kit']['r2r_version']} (source sha256 `{run['kit']['r2r_sha256'][:16]}`), "
      f"X3DUOM 4.1 sha256 `{run['kit']['uom_facts'].get('x3duom_41_sha256', '')[:16]}`. "
      + ("A language model proposed rules in this run; the proofs and grades below were computed without one. "
         if run.get("proposer", {}).get("uses_a_model") else "No language model was used. ")
      + "Every rule below is a **candidate**: nothing here is promoted, and a grade is always relative to the instrument named.")
    w("")
    g = run["grades"]
    shared = run.get("claims", run["candidates"]) - run["candidates"]
    w(f"**{run['candidates']} candidate rule(s) from {run['clusters']} failure cluster(s): {g['C']} Confirmed, {g['L']} Likely, "
      f"{g['S']} Suspected.** {run['events']} events (passes and failures) over {run['files_read']} distinct files; "
      f"{run['seconds']} s."
      + (f" {shared} time(s) a rule was found again under a second signature: it is one candidate, counted once by "
         f"its first claim, and shown under each cluster with that cluster's own proof." if shared else ""))
    w("")
    w("How to read a grade. **C, Confirmed**: the failures were observed by a tool, the rule fires on no file the tool "
      "passed, and it called outcomes it had never seen (probes built after the rule was fixed, or held-out receipts). "
      "**L, Likely**: clean on what induction saw, but nothing unseen has tested it. **S, Suspected**: a prediction was "
      "wrong, or the rule leans on literal values, or the evidence is one failure. **Closure** is separate: `open` means "
      "failures of the same signature exist that no rule here fires on, so a Confirmed rule can still be incomplete.")
    w("")
    w("Use the candidates as a pre-flight check: `kit/loom r2r check THIS_FOLDER FILE.x3d`. List what is still open: "
      "`kit/loom r2r needs THIS_FOLDER`.")
    w("")
    w("## Instruments and what they said")
    w("")
    w("| Instrument | Failed | Passed |")
    w("|---|---:|---:|")
    for inst, c in run["instruments"].items():
        w(f"| {inst} | {c['fail']} | {c['pass']} |")
    w("")
    for note in run.get("notes", []):
        w(f"- {note}")
    if run.get("notes"):
        w("")
    if run.get("inputs"):
        w("## Receipts read")
        w("")
        w("| Receipt | What | sha256 |")
        w("|---|---|---|")
        for i in run["inputs"]:
            w(f"| `{i.get('path')}` | {i.get('what', '')} | `{(i.get('sha256') or '')[:16]}` |")
        w("")
    w("## Candidates at a glance")
    w("")
    w("| Grade | Rule | Instrument and signature | Sources explained | Known-good false alarms | Held-out caught | "
      "Held-out false alarms | Audit probes right / wrong / missed | Closure |")
    w("|---|---|---|---:|---:|---:|---:|---:|---|")
    for c in clusters:
        for rid in c["rules"]:
            d = claim_of(cands[rid], c["instrument"], c["signature"])
            p, gr = d["proof"], d["grade"]
            a, h = p["audit"], p["held_out"]
            w(f"| **{gr['grade']}** | [`{rid}`](candidates/{rid}.json) `{_rule_text(d['rule'])}` | {d['instrument']}: "
              f"`{d['signature']}` | {_n(p['sources']['explained_by_this_rule'], p['sources']['failures'])} | "
              f"{p['known_good']['false_alarms']} of {p['known_good']['passing_files']} | {_n(h['caught'], h['failures'])} | "
              f"{h['false_alarms']} of {h['passing_files']} | {a['confirmed']} / {a['refuted']} / {a['missed']} | {gr['closure']} |")
    w("")
    w("## Clusters")
    for c in clusters:
        w("")
        w(f"### `{c['signature']}`")
        w("")
        if c.get("found_by", "receipts") != "receipts":
            w("**No receipt showed this failure. A probe of another cluster ran into it.**")
            w("")
        w(f"Instrument: {c['instrument']}. {c['training_failures']} distinct failing file(s) in training "
          f"({c['training_events']} events), {c['held_out_events']} held-out event(s). "
          f"{'Probed with the real instrument.' if c['probed'] else 'Not probed (no oracle for this instrument).'}")
        if c["same_root_cause_hints"]:
            for m in c["same_root_cause_hints"]:
                w(f"- One root cause? Rule `{m['rule']}` also explains {m['of_its_failures']} failures of `{m['also_explains']}`.")
        if c["residue"]:
            w(f"- **Residue: {c['residue']} failure(s) no rule explains.** " + "; ".join(f"`{x}`" for x in c["residue_examples"]))
        if not c["rules"]:
            w("- **No clean rule.** Best efforts that still raise false alarms:")
            for u in c["unclean_best_efforts"]:
                w(f"  - `{_rule_text(u['rule'])}` explains {u['explains']}, false alarms {u['false_alarms']} ({u['why']})")
        for rid in c["rules"]:
            d = claim_of(cands[rid], c["instrument"], c["signature"])
            p, gr = d["proof"], d["grade"]
            w("")
            w(f"#### {gr['grade']} ({WORD[gr['grade']]}) `{rid}`")
            w("")
            w(f"> {d['sentence']}")
            w("")
            w(f"`{json.dumps(d['rule'], sort_keys=True)}`")
            w("")
            w("Grade reasons: " + "; ".join(gr["reasons"]) + f". Closure: **{gr['closure']}** ({gr['closure_reason']}).")
            w("")
            a, h, s, k = p["audit"], p["held_out"], p["sources"], p["known_good"]
            w("| Test | Result |")
            w("|---|---|")
            w(f"| Source failures explained at the changed site | {s['explained_by_this_rule']} of {s['failures']} "
              f"({s['with_known_good_twin']} with a known-good twin; observed by {', '.join(f'{v} {kk}' for kk, v in s['observed_by'].items())}) |")
            w(f"| Fires on files the instrument passed | {k['false_alarms']} of {k['passing_files']} |")
            w(f"| Held-out failures caught (content-disjoint) | {_n(h['caught'], h['failures'])} |")
            w(f"| Held-out false alarms | {h['false_alarms']} of {h['passing_files']} |")
            if a["probes"]:
                w(f"| Audit probes (built after the rule was fixed) | {a['confirmed']} predictions came true, {a['refuted']} wrong, "
                  f"{a['missed']} failures the cluster's rules missed, {a['silent_ok']} correctly silent, "
                  f"{a['other_failure']} failed another way |")
            w(f"| Degenerate files it fires on | {', '.join(p['degenerate_fired_on']) or 'none of 8'} |")
            tr = p["existing_traps"]
            w(f"| Already covered by an existing Loom trap | {tr['any']} of {tr['checked']} checked"
              + (f" ({', '.join(f'{kk} {v}' for kk, v in tr['by_trap'].items())})" if tr["by_trap"] else "") + " |")
            w("")
            if p["probe_rounds"]:
                w("Probe rounds: " + "; ".join(
                    f"{r['round']}: " + ", ".join(f"{v} {kk}" for kk, v in sorted(r["tally"].items())) for r in p["probe_rounds"]) + ".")
                w("")
            if p["seen_at"]:
                w(f"Seen at {len(p['seen_at'])} place(s): " + ", ".join(p["seen_at"][:40]) + ".")
            if p["unfenced"]:
                u = p["unfenced"]
                w(f"Unfenced reading `{_rule_text(u['rule'])}`: {u['status']} ({u['false_alarms_on_known_good']} false alarm(s) on known-good files).")
            for iv in p["intervals"]:
                w(f"Threshold `{iv['literal']}`: last value seen to pass {iv['last_passing']}, first seen to fail {iv['first_failing']}; "
                  f"nothing between was tested.")
            for nr in p["normative_reading"]:
                w(f"Normative reading: every explained failure also has `{nr['literal']}` ({nr['means']}); "
                  f"{nr['passing_files_with_it_inside_the_fence']} passing file(s) have it too inside the fence.")
            if p["alternates"]:
                w("")
                w(f"Alternates the receipts could not rule out ({len(p['alternates'])}):")
                for alt in p["alternates"][:4]:
                    w(f"- `{_rule_text(alt['rule'])}`")
            if p["idle_literals"]:
                w(f"Literals whose removal changes nothing on this evidence: {', '.join('`' + x + '`' for x in p['idle_literals'])}.")
            w("")
            w("Ablation (drop one literal, count again):")
            w("")
            w("| Dropped | Role | False alarms without it | Failures explained without it |")
            w("|---|---|---:|---:|")
            for ab in p["ablation"]:
                w(f"| `{ab['dropped']}` | {ab['role']} | {ab['false_alarms_without_it']} | {ab['failures_explained_without_it']} |")
            w("")
            w("How the rule was reached: " + "; then ".join(f"`{t}`" for t in p["trace"][:8]) + ".")
            w("")
            w(f"Sources ({d['sources_total']}; first {min(5, len(d['sources']))}):")
            for src in d["sources"][:5]:
                w(f"- `{src['file']}` ({src['note']})")
    out = run_dir / "REPORT.md"
    out.write_text("\n".join(L) + "\n", encoding="utf-8")
    return out
