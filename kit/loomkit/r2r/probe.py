"""Probes: experiments that ask the instrument what the receipts could not say.

Induction ends with a rule, a fence around it, and a list of doubts: is the fence too tight, could one of the
alternates be the real cause, where exactly does a threshold sit. Each doubt names an experiment. A probe is a clean
host file with ONE planted edit, chosen so that two readings of the evidence predict different outcomes:

  confirm     inside the fence, on a file never seen, with a value that failed before: the rule says FAIL
  widen       just outside the fence, same value: the fenced rule says pass, the unfenced one says FAIL
  value       at a site just shown to be live, a variant of the value the rule still fires on: FAIL
  near        at a live site, a variant the rule does not fire on: PASS
  alternate   at a live site, a variant on which the rule and one alternate disagree
  bisect      inside a threshold's untested stretch: nobody knows

The design is factorial, because an importer only fails where it actually reads. PLACE probes (confirm, widen) carry
a value copied verbatim from a real failure, so their outcome speaks about the place and nothing else. VALUE probes
(value, near, alternate, bisect) are planted only at a site where a place probe has just failed, so their outcome
speaks about the value and nothing else. Without that split, "this spelling is harmless" and "the importer never
looks here" are the same observation.

Each probe is run with its twin (the host, unedited). Results go back in as ordinary receipts and induction runs again;
the loop stops when a round changes no rule. Then one more round is run and NOT fed back: its count of predictions
that came true is the number the grade may use, because the rule was fixed before those files existed.

This is the part of R2R that an LLM-only pipeline cannot fake: the rule is not judged by how plausible it reads but by
whether it can call the instrument's next move.
"""
from __future__ import annotations

import hashlib
import math
import random
from pathlib import Path

from . import lexical as lx
from . import plant
from .events import Case, Event, EventSet
from .induce import Candidate, Induction, Pool, Problem, induce
from .rule import Rule
from .uom import facts

QUOTA = {"confirm": 10, "widen": 16, "value": 10, "near": 8, "alternate": 6, "bisect": 6}
MAX_HOST_BYTES = 80_000
DOC_PLANTERS = {"depth_max": "deepen", "n_elements": "widen", "bytes": "pad", "max_children": "widen"}
TOKEN_NUMBERS = {"index_excess", "index_max", "max_abs", "max"}


class Host:
    """A clean file to plant in, written once by the plant serialiser: that text is the twin of every plant on it."""

    def __init__(self, name: str, data: bytes):
        self.name = name
        self.data = plant.twin(data) if len(data) <= MAX_HOST_BYTES else None
        self.case = Case(name, self.data) if self.data else None
        self.sha256 = hashlib.sha256(data).hexdigest()         # of the file as given, before the plant serialiser
        self.key = hashlib.sha256(self.data).hexdigest()[:12] if self.data else ""


class Probe:
    __slots__ = ("pid", "host", "data", "why", "detail", "fires", "general_fires", "target", "file", "outcome",
                 "signature", "verdict", "site", "recipe")

    def __init__(self, host: Host, data: bytes, why: str, detail: str, fires: bool, general_fires: bool, target: str,
                 site: tuple | None = None, recipe: list | None = None):
        self.host, self.data, self.why, self.detail = host, data, why, detail
        self.fires, self.general_fires, self.target, self.site = fires, general_fires, target, site
        self.recipe = recipe or (["set_attr", site[0], site[2], site[3]] if site else None)
        self.pid = hashlib.sha256(data).hexdigest()[:12]
        self.file = self.outcome = self.signature = self.verdict = None

    def to_json(self) -> dict:
        """Enough to build the probe again: the host (by name and hash), and the one edit as a plant.apply recipe."""
        return {"probe": self.pid, "sha256": hashlib.sha256(self.data).hexdigest(), "host": self.host.name,
                "host_sha256": self.host.sha256, "recipe": self.recipe, "why": self.why, "edit": self.detail,
                "rule_fires": self.fires, "unfenced_rule_fires": self.general_fires, "rule": self.target,
                "outcome": self.outcome, "signature": self.signature, "verdict": self.verdict}


def _values(problem: Problem, cand: Candidate) -> list[str]:
    seen: dict[str, None] = {}
    for ex in cand.covered:
        for s in problem.explained(cand.rule, ex):
            if s.attr and s.el is not None:
                v = s.el.attrib.get(s.attr)
                if v is not None and len(v) <= 4000:
                    seen.setdefault(v, None)
    return list(seen)


def _variants(v: str) -> list[str]:
    if not v or len(v) > 40:
        return []
    out = [v.upper(), v.lower(), v.title(), f"{v} {v}", f"{v},{v}", f'"{v}"', f" {v} "]
    return [x for x in dict.fromkeys(out) if x != v]


def _places(problem: Problem, cand: Candidate):
    places, attrs, types, classes, tags = set(), set(), set(), set(), set()
    for ex in cand.covered:
        for s in problem.explained(cand.rule, ex):
            if s.el is None:
                continue
            tags.add(s.el.tag)
            if s.attr:
                places.add((s.el.tag, s.attr))
                attrs.add(s.attr)
                for l in s.lits:
                    if l.startswith("t:"):
                        types.add(l[2:])
                    elif l.startswith("tc:"):
                        classes.add(l[3:])
    return places, attrs, types, classes, tags


def _fires(rule: Rule | None, case: Case) -> bool:
    return bool(rule) and rule.could_fire(case.bag) and rule.fires(case.sites)


class _Picker:
    """Quota-bound choice that spreads probes over hosts and edits."""

    def __init__(self, rng: random.Random, taken: set):
        self.rng, self.taken = rng, taken
        self.bins: dict[str, list[Probe]] = {}

    def offer(self, p: Probe) -> None:
        if p.pid in self.taken:
            return
        self.bins.setdefault(p.why.split(":")[0], []).append(p)

    def pick(self, quota: dict) -> list[Probe]:
        out = []
        for why, items in sorted(self.bins.items()):
            self.rng.shuffle(items)
            seen_host, seen_detail, chosen, later = set(), set(), [], []
            for p in items:
                key = p.detail.split(" <- ")[0]
                if p.host.name in seen_host or key in seen_detail:
                    later.append(p)
                else:
                    seen_host.add(p.host.name)
                    seen_detail.add(key)
                    chosen.append(p)
            chosen += later
            for p in chosen[:quota.get(why, 4)]:
                if p.pid not in self.taken:
                    self.taken.add(p.pid)
                    out.append(p)
        return out


def _design_places(problem: Problem, cand: Candidate, hosts: list[Host], rng: random.Random, picker: _Picker) -> None:
    """PLACE probes: a value that really failed, copied verbatim to sites inside and just outside the fence."""
    f = facts()
    places, attrs, types, classes, _tags = _places(problem, cand)
    values = _values(problem, cand)
    if not values:
        return
    rng.shuffle(values)
    values = values[:8]
    general = cand.general or cand.rule
    slots: dict[int, list] = {0: [], 1: [], 2: [], 3: []}
    for h in hosts:
        if _fires(general, h.case):
            continue                                  # a host the rule already fires on would confound the plant
        for s in h.case.sites:
            if s.kind != "elem" or not f.is_node(s.el.tag):
                continue
            for name, row in f.fields(s.el.tag).items():
                if row["t"] in ("SFNode", "MFNode") or row.get("acc") in ("outputOnly", "inputOnly"):
                    continue
                if classes and lx.type_class(row["t"]) not in classes:
                    continue
                ring = 0 if (s.el.tag, name) in places else 1 if name in attrs else 2 if row["t"] in types else 3
                slots[ring].append((h, s.el.path(), s.el.tag, name))
    caps = {0: 60, 1: 60, 2: 50, 3: 30}
    for ring, items in slots.items():
        rng.shuffle(items)
        # spread over distinct places first
        by_place: dict[tuple, list] = {}
        for it in items:
            by_place.setdefault((it[2], it[3]), []).append(it)
        ordered = []
        while by_place and len(ordered) < caps[ring]:
            for key in list(by_place):
                ordered.append(by_place[key].pop())
                if not by_place[key]:
                    del by_place[key]
        for i, (h, path, tag, name) in enumerate(ordered[:caps[ring]]):
            v = values[i % len(values)]
            data = plant.set_attr(h.data, path, name, v)
            if data is None or data == h.data:
                continue
            case = Case(f"{h.name}#{tag}@{name}", data)
            r, g = _fires(cand.rule, case), _fires(general, case)
            why = "confirm" if r else "widen" if g else None
            if why:
                picker.offer(Probe(h, data, why, f"{tag}@{name} <- {v!r}"[:200], r, g, cand.rule.rid(),
                                   site=(path, tag, name, v)))


def _design_values(problem: Problem, cand: Candidate, live: list[Probe], rng: random.Random, picker: _Picker) -> None:
    """VALUE probes: at sites the instrument has just been seen to read, vary the value."""
    alternates = [a for a in cand.alternates if a.kind == "attr"][:4]
    general = cand.general or cand.rule
    int_field = "tc:int" in _lits_of(problem, cand)
    rng.shuffle(live)
    for control in live[:14]:
        h = control.host
        path, tag, name, v = control.site
        for x in _variants(v):
            data = plant.set_attr(h.data, path, name, x)
            if data is None or data == h.data:
                continue
            case = Case(f"{h.name}#{tag}@{name}", data)
            r = _fires(cand.rule, case)
            why = "value" if r else "near"
            for i, a in enumerate(alternates):
                if _fires(a, case) != r:
                    why = f"alternate:{i}"
                    break
            picker.offer(Probe(h, data, why, f"{tag}@{name} <- {x!r} (live: {v!r} failed here)"[:200], r,
                               _fires(general, case), cand.rule.rid(), site=(path, tag, name, x)))
        for iv in cand.intervals:
            if iv["untested"] is None or iv["number"] not in TOKEN_NUMBERS:
                continue
            for t in _midpoints(*iv["untested"]):
                toks = lx.tokens(v)
                if not toks:
                    continue
                k = max(range(len(toks)), key=lambda i: abs(lx.lenient_number(toks[i])[0] or 0))
                toks[k] = str(int(t)) if int_field else repr(float(t))
                data = plant.set_attr(h.data, path, name, " ".join(toks))
                if data is None:
                    continue
                case = Case(f"{h.name}#{tag}@{name}", data)
                r = _fires(cand.rule, case)
                picker.offer(Probe(h, data, "bisect", f"{tag}@{name} <- {iv['number']} near {t:g}", r,
                                   _fires(general, case), cand.rule.rid(), site=(path, tag, name, " ".join(toks))))


def _classify(cand: Candidate, case: Case, alternates: list[Rule]) -> tuple[str | None, bool, bool]:
    r = _fires(cand.rule, case)
    g = _fires(cand.general, case) if cand.general is not None else r
    for i, a in enumerate(alternates):
        if _fires(a, case) != r:
            return f"alternate:{i}", r, g
    if r:
        return "confirm", r, g
    if g:
        return "widen", r, g
    return None, r, g


def _lits_of(problem: Problem, cand: Candidate) -> set:
    out: set = set()
    for ex in cand.covered[:3]:
        for s in problem.explained(cand.rule, ex):
            out |= s.lits
    return out


def _midpoints(lo: float, hi: float) -> list[float]:
    if not (math.isfinite(lo) and math.isfinite(hi)) or hi - lo <= 1:
        return []
    if lo > 0 and hi / lo > 100:
        a, b = math.log(lo), math.log(hi)
        pts = [math.exp(a + (b - a) * q) for q in (0.25, 0.5, 0.75)]
    else:
        pts = [lo + (hi - lo) * q for q in (0.25, 0.5, 0.75)]
    return [float(round(p)) for p in pts if lo < round(p) < hi]


def _design_doc(problem: Problem, cand: Candidate, hosts: list[Host], rng: random.Random, picker: _Picker) -> None:
    """A size limit is a claim about both sides of a number: at the threshold and above it the instrument fails, one
    step below it passes. Each side gets probes, on fresh hosts every round, and so does each untested stretch."""
    alternates = [a for a in cand.alternates if a.kind == "doc"][:6]
    mine = {name: theta for op, name, theta in cand.rule._thr if op == "ge" and name in DOC_PLANTERS}
    targets: dict[str, set] = {}
    for name, theta in mine.items():
        targets.setdefault(name, set()).update({("at", theta), ("at", math.ceil(theta * 1.25)), ("below", theta - 1)})
    for rule in alternates:
        for op, name, theta in rule._thr:
            if op == "ge" and name in DOC_PLANTERS:
                targets.setdefault(name, set()).add(("at", theta))
    for iv in cand.intervals:
        if iv["untested"] and iv["number"] in DOC_PLANTERS:
            for t in _midpoints(*iv["untested"]):
                targets.setdefault(iv["number"], set()).add(("bisect", t))
    small = sorted((h for h in hosts if not _fires(cand.rule, h.case)), key=lambda h: len(h.data))[:40]
    for name, wanted in targets.items():
        for kind, t in sorted(wanted, key=str):
            rng.shuffle(small)
            for h in small[:8]:
                have = h.case.nums.get(name, 0)
                need = int(t - have)
                if need <= 0:
                    continue
                data = getattr(plant, DOC_PLANTERS[name])(h.data, need)
                if data is None:
                    continue
                case = Case(f"{h.name}#{name}", data)
                recipe = [DOC_PLANTERS[name], need]
                if kind == "bisect":
                    r = _fires(cand.rule, case)
                    picker.offer(Probe(h, data, "bisect", f"{name} raised to about {t:g}", r, r, cand.rule.rid(), recipe=recipe))
                    continue
                why, r, g = _classify(cand, case, alternates)
                if why is None and kind == "below":
                    why = "near"                      # one step under the threshold: the rule says this one passes
                if why:
                    picker.offer(Probe(h, data, why, f"{name} raised to {t:g} by {DOC_PLANTERS[name]}", r, g,
                                       cand.rule.rid(), recipe=recipe))


def _design_elem(problem: Problem, cand: Candidate, hosts: list[Host], rng: random.Random, picker: _Picker) -> None:
    f = facts()
    _places_, _attrs, _types, _classes, tags = _places(problem, cand)
    alternates = [a for a in cand.alternates if a.kind == "elem"][:4]
    # node types that could stand where a seen type stands: those sharing its most specific abstract type
    siblings: dict[str, set] = {}
    for t in tags:
        isa = f.isa(t)
        if isa:
            siblings[t] = {n for n, row in f.nodes.items() if isa[0] in row["isa"] and n != t}
    todo = []
    for h in hosts:
        if _fires(cand.general or cand.rule, h.case):
            continue
        for s in h.case.sites:
            if s.kind != "elem" or not f.is_node(s.el.tag):
                continue
            tag, path = s.el.tag, s.el.path()
            if tag in tags:
                for a in list(s.el.attrib)[:6]:
                    todo.append((h, "del_attr", path, a, 0))
                todo.append((h, "dup_elem", path, None, 0))
                for c in s.el.children[:4]:
                    todo.append((h, "del_elem", c.path(), None, 0))
            for seen, sibs in siblings.items():
                if tag in sibs:
                    todo.append((h, "rename_elem", path, seen, 1))
    rng.shuffle(todo)
    for h, op, path, arg, ring in todo[:260]:
        if op == "del_attr":
            data = plant.del_attr(h.data, path, arg)
        elif op == "rename_elem":
            data = plant.rename_elem(h.data, path, arg, set(f.fields(arg)))
        else:
            data = getattr(plant, op)(h.data, path)
        if data is None or data == h.data:
            continue
        case = Case(f"{h.name}#{op}", data)
        why, r, g = _classify(cand, case, alternates)
        if why:
            picker.offer(Probe(h, data, why, f"{op} {path.rsplit('/', 1)[-1]}" + (f" {arg}" if arg else ""), r, g,
                               cand.rule.rid(), recipe=[op, path] + ([arg] if arg else [])))


def design(problem: Problem, cand: Candidate, hosts: list[Host], rng: random.Random, taken: set,
           quota: dict | None = None, live: list[Probe] | None = None) -> list[Probe]:
    """Probes for one rule. For an attribute rule this is called twice a round: first without `live` (place probes),
    then with the place probes that failed (value probes at those sites)."""
    picker = _Picker(rng, taken)
    hosts = [h for h in hosts if h.case is not None]
    if cand.rule.kind == "attr":
        if live is None:
            _design_places(problem, cand, hosts, rng, picker)
        else:
            _design_values(problem, cand, live, rng, picker)
    elif live is None:
        if cand.rule.kind == "elem":
            _design_elem(problem, cand, hosts, rng, picker)
        else:
            _design_doc(problem, cand, hosts, rng, picker)
    return picker.pick(quota or QUOTA)


def verdict(fires: bool, outcome: str, signature: str, wanted: str) -> str:
    if outcome == "skip" or outcome is None:
        return "no-verdict"
    if outcome == "fail" and signature != wanted:
        return "other-failure"
    if fires:
        return "confirmed" if outcome == "fail" else "refuted"
    return "missed" if outcome == "fail" else "silent-ok"


def _ask(es: EventSet, instrument: str, signature: str, probes: list[Probe], oracle, workdir: Path, twin_ok: dict,
         label: str, feed_back: bool) -> None:
    """Write the probes and their twins, run the oracle, judge each probe, add the outcomes as receipts."""
    if not probes:
        return
    (workdir / "probes").mkdir(parents=True, exist_ok=True)
    (workdir / "twins").mkdir(parents=True, exist_ok=True)
    files, twin_files = [], {}
    for p in probes:
        p.file = str(workdir / "probes" / f"{label}-{p.pid}.x3d")
        Path(p.file).write_bytes(p.data)
        files.append(p.file)
        if p.host.key not in twin_files:
            tf = workdir / "twins" / f"{p.host.key}.x3d"
            if not tf.exists():
                tf.write_bytes(p.host.data)
            twin_files[p.host.key] = str(tf)
    need_twins = [tf for k, tf in twin_files.items() if k not in twin_ok]
    res = oracle.run(need_twins + files, workdir / "oracle")
    new_events = []
    for k, tf in twin_files.items():
        if k not in twin_ok:
            twin_ok[k] = res.get(tf, {}).get("outcome") == "pass"
            if twin_ok[k]:
                new_events.append(Event(instrument, "pass", tf, group=f"probe-host:{k}", family="r2r-probe",
                                        note="probe twin", label="probe-twin", split="train"))
    for p in probes:
        r = res.get(p.file, {})
        p.outcome, p.signature = r.get("outcome"), r.get("signature", "")
        if not twin_ok[p.host.key]:
            p.verdict = "no-verdict"          # the host itself fails the instrument: nothing can be blamed on the plant
            continue
        p.verdict = verdict(p.fires, p.outcome, p.signature, signature)
        if p.outcome in ("pass", "fail"):
            new_events.append(Event(instrument, p.outcome, p.file, p.signature if p.outcome == "fail" else "",
                                    twin=twin_files[p.host.key], group=f"probe-host:{p.host.key}", family="r2r-probe",
                                    note=f"{p.why}: {p.detail}", label=f"probe:{p.why}",
                                    split="train" if feed_back else "audit"))
    es.add(new_events)


def run_round(es: EventSet, instrument: str, signature: str, ind: Induction, oracle, hosts: list[Host], workdir: Path,
              rng: random.Random, taken: set, twin_ok: dict, label: str, feed_back: bool, log=None) -> list[Probe]:
    """Design, run and judge one round of probes for every rule of one cluster: places first, then values at the
    sites the place probes showed to be live."""
    workdir = Path(workdir)
    out: list[Probe] = []
    for cand in ind.candidates:
        first = design(ind.problem, cand, hosts, rng, taken)
        _ask(es, instrument, signature, first, oracle, workdir, twin_ok, label, feed_back)
        out += first
        if cand.rule.kind == "attr":
            live = [p for p in first if p.why == "confirm" and p.verdict == "confirmed" and p.site]
            second = design(ind.problem, cand, hosts, rng, taken, live=live)
            _ask(es, instrument, signature, second, oracle, workdir, twin_ok, label, feed_back)
            out += second
    if log and out:
        tally: dict[str, int] = {}
        for p in out:
            tally[p.verdict] = tally.get(p.verdict, 0) + 1
        log(f"{label}: {len(out)} probe(s): " + ", ".join(f"{v} {k}" for k, v in sorted(tally.items())))
    return out


def build_problem(es: EventSet, instrument: str, signature: str, splits=("train",)) -> Problem:
    exs = [es.example(e) for e in es.events if e.instrument == instrument and e.split in splits]
    pool = Pool(exs)
    pos = [ex for ex in exs if ex.event.outcome == "fail" and ex.event.signature == signature]
    return Problem(instrument, signature, pos, pool)


def refine(es: EventSet, instrument: str, signature: str, oracle, hosts: list[Host], workdir: Path, rounds: int = 3,
           seed: int = 0, log=None, induce=induce) -> tuple[Induction, list[dict]]:
    """Induce, probe, feed back, repeat; then one audit round that is not fed back. Returns the final induction and
    the history: one entry per round with the rules it tested and every probe's verdict."""
    rng = random.Random(seed)
    taken: set = set()
    twin_ok: dict = {}
    history = []
    ind = induce(build_problem(es, instrument, signature))
    for k in range(1, rounds + 1):
        before = [c.rule.key() for c in ind.candidates]
        probes = run_round(es, instrument, signature, ind, oracle, hosts, workdir, rng, taken, twin_ok, f"round{k}", True, log)
        history.append({"round": k, "fed_back": True, "rules": [repr(c.rule) for c in ind.candidates],
                        "probes": [p.to_json() for p in probes]})
        if not probes:
            break
        ind = induce(build_problem(es, instrument, signature))
        after = [c.rule.key() for c in ind.candidates]
        surprises = sum(1 for p in probes if p.verdict in ("refuted", "missed"))
        if log:
            log(f"round{k}: {surprises} surprise(s); rules {'unchanged' if after == before else 'changed'}")
        if after == before and surprises == 0:
            break
    audit = run_round(es, instrument, signature, ind, oracle, hosts, workdir, rng, taken, twin_ok, "audit", False, log)
    # the audit is judged against every final rule of the cluster, not only the rule each probe was designed around
    rules = [c.rule for c in ind.candidates]
    for p in audit:
        if p.verdict != "no-verdict":
            case = es.corpus.case(p.file)
            fired = any(r.could_fire(case.bag) and r.fires(case.sites) for r in rules)
            p.fires = fired
            p.verdict = verdict(fired, p.outcome, p.signature, signature)
    history.append({"round": "audit", "fed_back": False, "rules": [repr(r) for r in rules],
                    "probes": [p.to_json() for p in audit]})
    return ind, history
