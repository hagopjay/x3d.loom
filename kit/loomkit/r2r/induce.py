"""Induction: from a cluster of failures that share a signature to the narrowest rule that separates them from the files
the same instrument was seen to pass.

How it works, in the order it happens:

  1. ANCHOR. A failing file with a known-good twin is compared with it; only the sites that changed may explain the
     failure. A failing file with no twin may be explained by any of its sites (weaker, and the grade says so).
  2. SEED. Every new test literal at an anchor site, every lost attribute or child, and every changed number (as a
     threshold) is a seed: a one-literal rule.
  3. SCOPE. The seed is fenced to where its failures were seen: the node and attribute if there was one place, the
     attribute if several nodes shared it, else the field type, else the type class. This is law 32's lesson made
     mechanical: a rule is not read wider than what was tested. The unfenced rule is kept beside it as `general`,
     marked untested, and probe.py is what may widen the fence.
  4. SPECIALISE. While the rule fires on a file the instrument passed, add the literal that removes the most false
     alarms per failure kept (FOIL's gain). A small beam keeps the best few paths. The number of literals a rule may
     spend is capped by how many failures it explains, so one failure cannot buy a five-literal story.
  5. PRUNE. Drop every literal whose removal brings back no false alarm and loses no failure.
  6. COVER. Take the rule that explains the most failures, then the next for what is left. Ties go to the rule with the
     fewest literals, then to the one that claims least (fires at the fewest sites anywhere), then to the cheapest.

What comes out with each rule matters as much as the rule:

  alternates   other clean rules that explain the same failures. The receipts cannot choose between them; a probe can.
  general      the rule without its fence, and whether the passing files already contradict it.
  intervals    for every threshold, the stretch between the last value seen to pass and the first seen to fail.
  strays       failures with OTHER signatures the rule also fires on. Many strays into one signature means two
               signatures share a root cause.
  residue      failures no rule explains. They are reported, never forced into a rule.
  gap          set when the rule leans on literal values: the vocabulary lacks a word for what those values share.
"""
from __future__ import annotations

import bisect
import math

from . import features as F
from .events import Example
from .rule import Rule, holds
from .uom import facts as _facts

MAX_LITERALS = 7
BEAM = 3
EXPANSIONS_PER_SEED = 18
SEEDS_PER_ROUND = 80
FP_SAMPLE = 400
RARE = 0.2
MAX_PLACES = 64
MIN_PASSING_FOR_THRESHOLD = 30   # a threshold drawn against a handful of passing files is a coincidence, not a cliff
INCIDENTAL_NUMBERS = {"bytes", "len", "text_len", "max_attr_len", "nattrs"}   # change with almost any edit
NO_REFINE_NUMBERS = INCIDENTAL_NUMBERS | {"min", "max", "depth", "nstrings"}
THRESHOLD_QUANTILES = (0.0, 0.25, 0.5)      # a threshold seed takes in all, 3/4 or 1/2 of the failures that moved the number


def budget(n_failures: int) -> int:
    """How many literals (outside the fence) a rule explaining this many failures may use: 2 for one failure, 3 for
    two or three, one more each time the count doubles, 7 at most."""
    return min(MAX_LITERALS, 1 + math.ceil(math.log2(n_failures + 1)))


class Pool:
    """Every file one instrument was run on, indexed by literal, so "where does this rule fire" is a lookup."""

    def __init__(self, examples: list[Example]):
        self.examples: list[Example] = []
        self.owner: dict[int, Example] = {}
        self.post: dict[str, list] = {}
        self._nums: dict[str, list] = {}
        self._sorted: dict[str, tuple] = {}
        seen = set()
        for ex in examples:
            if id(ex.case) in seen:
                continue
            seen.add(id(ex.case))
            self.examples.append(ex)
            for s in ex.case.sites:
                self.owner[id(s)] = ex
                for l in s.lits:
                    self.post.setdefault(l, []).append(s)
                for k, v in s.nums.items():
                    self._nums.setdefault(k, []).append((v, s))
        self.n_pass = sum(1 for ex in self.examples if ex.event.outcome == "pass")

    def _by_number(self, name: str) -> tuple:
        t = self._sorted.get(name)
        if t is None:
            pairs = sorted(self._nums.get(name, ()), key=lambda p: p[0])
            t = self._sorted[name] = ([p[0] for p in pairs], [p[1] for p in pairs])
        return t

    def sites(self, rule: Rule) -> list:
        """Every site in the pool at which the rule fires."""
        best = None
        for l in rule._pos:
            p = self.post.get(l)
            if p is None:
                return []
            if best is None or len(p) < len(best):
                best = p
        for op, name, theta in rule._thr:
            vals, sites = self._by_number(name)
            cand = sites[bisect.bisect_left(vals, theta):] if op == "ge" else sites[:bisect.bisect_right(vals, theta)]
            if best is None or len(cand) < len(best):
                best = cand
        return [s for s in (best or ()) if rule.matches(s)]

    def hits(self, rule: Rule, outcome: str | None = "pass", signature: str | None = None) -> dict:
        """{example: [sites]} for the files with this outcome the rule fires on."""
        out: dict = {}
        for s in self.sites(rule):
            ex = self.owner[id(s)]
            if outcome is not None and ex.event.outcome != outcome:
                continue
            if signature is not None and ex.event.signature != signature:
                continue
            out.setdefault(ex, []).append(s)
        return out

    def false_alarm(self, rule: Rule) -> bool:
        return any(self.owner[id(s)].event.outcome == "pass" for s in self.sites(rule))

    def breadth(self, rule: Rule) -> int:
        return len(self.sites(rule))


class Problem:
    """One cluster: the failures to explain, and the pool of everything the same instrument was run on."""

    def __init__(self, instrument: str, signature: str, pos: list[Example], pool: Pool):
        self.instrument, self.signature, self.pool = instrument, signature, pool
        seen, self.pos = set(), []
        for ex in pos:
            if id(ex.case) not in seen:
                seen.add(id(ex.case))
                self.pos.append(ex)
        self._anchors: dict[int, list] = {}

    def anchors(self, ex: Example) -> list:
        a = self._anchors.get(id(ex))
        if a is None:
            a = self._anchors[id(ex)] = ex.anchor_sites()
        return a

    def explained(self, rule: Rule, ex: Example) -> list:
        """The anchor sites of a failing example at which the rule fires."""
        return [s for s in self.anchors(ex) if rule.matches(s)]


class Candidate:
    __slots__ = ("rule", "scope", "covered", "false_alarms", "strays", "alternates", "general", "general_false_alarms",
                 "seen_at", "intervals", "trace", "gap", "seed", "breadth", "newly")

    def __init__(self, rule: Rule, scope: tuple, covered: list, false_alarms: int, seed: str = ""):
        self.rule, self.scope, self.covered, self.false_alarms, self.seed = rule, tuple(scope), covered, false_alarms, seed
        self.strays: dict[str, int] = {}
        self.alternates: list[Rule] = []
        self.general: Rule | None = None
        self.general_false_alarms: int | None = None
        self.seen_at: list[str] = []
        self.intervals: list[dict] = []
        self.trace: list[str] = []
        self.gap = False
        self.breadth = 0
        self.newly = 0

    def core(self) -> list[str]:
        return [l for l in self.rule.all if l not in self.scope]


class Induction:
    def __init__(self, problem: Problem):
        self.problem = problem
        self.candidates: list[Candidate] = []
        self.residue: list[Example] = []
        self.unclean: list[Candidate] = []          # best efforts that still raise false alarms, for the report
        self.outside: list[Example] = []            # failures whose bytes the instrument also passed
        self.log: list[str] = []
        self.n_seeds = 0


def _fmt(v: float) -> str:
    v = float(v)
    return repr(int(v)) if math.isfinite(v) and v.is_integer() and abs(v) < 1e15 else repr(v)


def seeds(problem: Problem, among: list[Example]) -> dict[tuple, int]:
    """(kind, literal) -> how many of these failures offer it."""
    out: dict[tuple, int] = {}
    pool = problem.pool
    n_pass = max(1, pool.n_pass)
    thresholds = pool.n_pass >= MIN_PASSING_FOR_THRESHOLD
    spans: dict[tuple, list] = {}        # (kind, number) -> one (lowest, highest) changed value per failure
    for ex in among:
        mine = set()
        local: dict[tuple, list] = {}
        d = ex.diff
        if d is not None:
            for site, new, lost, nums, _pair in d:
                for l in new:
                    if F.role(l) == "test":
                        mine.add((site.kind, l))
                for l in lost:
                    if l.startswith(("has:", "child:")):
                        mine.add((site.kind, "!" + l))
                for k, v in nums.items():
                    if thresholds and isinstance(v, (int, float)) and not (isinstance(v, float) and math.isnan(v)):
                        span = local.setdefault((site.kind, k), [v, v])
                        span[0], span[1] = min(span[0], v), max(span[1], v)
        else:
            # no twin: anything rare in the passing files may be the reason, and so may the mere presence of a node or
            # an attribute (the two universal seeds, which the search then narrows by node and attribute)
            mine.add(("elem", "x:present"))
            mine.add(("attr", "v:present"))
            for site in ex.case.sites:
                for l in site.lits:
                    if F.role(l) == "test" and len(pool.post.get(l, ())) / n_pass < RARE:
                        mine.add((site.kind, l))
                if site.kind == "doc" and thresholds:
                    for k, v in site.nums.items():
                        if isinstance(v, (int, float)) and not (isinstance(v, float) and math.isnan(v)):
                            local[("doc", k)] = [v, v]
        for m in mine:
            out[m] = out.get(m, 0) + 1
        for key, span in local.items():
            spans.setdefault(key, []).append(span)
    # Thresholds. Every failure has its own number (its own depth, its own largest index), so "how many failures offer
    # this literal" would rank a threshold by coincidence. A threshold is offered at the value that takes in all of the
    # failures that moved this number, at three quarters of them and at half, and is counted by what it takes in.
    for (kind, name), per_failure in spans.items():
        highs = sorted(h for _lo, h in per_failure)
        lows = sorted((lo for lo, _h in per_failure), reverse=True)
        for q in THRESHOLD_QUANTILES:
            theta = highs[int(q * (len(highs) - 1))]
            key = (kind, f"ge:{name}:{_fmt(theta)}")
            out[key] = max(out.get(key, 0), sum(1 for h in highs if h >= theta))
            if name not in INCIDENTAL_NUMBERS:
                theta = lows[int(q * (len(lows) - 1))]
                key = (kind, f"le:{name}:{_fmt(theta)}")
                out[key] = max(out.get(key, 0), sum(1 for lo in lows if lo <= theta))
    return out


def scope_of(kind: str, sites: list) -> tuple[tuple, tuple]:
    """The fence: (literals that must all hold, literals of which one must hold).

    One place seen: that place. A handful of places seen: the list of them, as an OR-group; the rule then claims
    nothing about a node or attribute where no failure was observed. Only when failures were seen at more places than
    a list can carry does the fence fall back to what those places share (attribute, field type, type class)."""
    if kind == "doc" or not sites:
        return (), ()
    if kind == "attr":
        places = sorted({l for s in sites for l in s.lits if l.startswith("at:")})
        if len(places) == 1:
            return (places[0],), ()
        if len(places) <= MAX_PLACES:
            return (), tuple(places)
        for prefix in ("a:", "t:", "tc:", "n:"):
            vals = {frozenset(l for l in s.lits if l.startswith(prefix)) for s in sites}
            if len(vals) == 1 and next(iter(vals)):
                return tuple(sorted(next(iter(vals)))), ()
        return (), ()
    nodes = sorted({l for s in sites for l in s.lits if l.startswith("n:")})
    if len(nodes) == 1:
        return (nodes[0],), ()
    if len(nodes) <= MAX_PLACES:
        return (), tuple(nodes)
    shared = None
    for s in sites:
        isa = {l for l in s.lits if l.startswith("isa:")}
        shared = isa if shared is None else shared & isa
    if shared:
        # the shared abstract type that the fewest node types inherit is the tightest fence
        nodes_all = _facts().nodes.values()
        return (min(shared, key=lambda l: (sum(1 for n in nodes_all if l[4:] in n["isa"]), l)),), ()
    return (), ()


def fires(rule: Rule, ex: Example) -> bool:
    return rule.could_fire(ex.case.bag) and rule.fires(ex.case.sites)


def _gain(p0: int, n0: int, p1: int, n1: int) -> float:
    if p1 == 0:
        return -1.0
    return p1 * (math.log2(p1 / (p1 + n1)) - math.log2(p0 / (p0 + n0)))


def _sample(hits: dict, k: int) -> dict:
    if len(hits) <= k:
        return hits
    keys = sorted(hits, key=lambda ex: ex.case.sha256)
    step = len(keys) / k
    return {keys[int(i * step)]: hits[keys[int(i * step)]] for i in range(k)}


def _tally(hits: dict) -> tuple[dict, dict]:
    """For each literal: in how many examples some hit site has it, and in how many every hit site has it."""
    some: dict[str, int] = {}
    every: dict[str, int] = {}
    for sites in hits.values():
        if len(sites) == 1:
            u = i = sites[0].lits
        else:
            u = frozenset().union(*(s.lits for s in sites))
            i = frozenset.intersection(*(s.lits for s in sites))
        for l in u:
            some[l] = some.get(l, 0) + 1
        for l in i:
            every[l] = every.get(l, 0) + 1
    return some, every


def _refinements(rule: Rule, pos_hits: dict, fp_hits: dict, thresholds: bool = True) -> list[tuple]:
    """One-literal specialisations, best first: (gain, cost, literal)."""
    have = set(rule.all)
    thr_names = {l.lstrip("!").split(":")[1] for l in rule.all if l.lstrip("!").startswith(("ge:", "le:"))}
    p0, n_full = len(pos_hits), len(fp_hits)
    fp = _sample(fp_hits, FP_SAMPLE)
    n0 = len(fp)
    pos_some, pos_every = _tally(pos_hits)
    fp_some, fp_every = _tally(fp)
    out = []
    for l, p1 in pos_some.items():
        if l in have or l.startswith("kind:"):
            continue
        n1 = fp_some.get(l, 0)
        if n1 < n0:
            out.append((_gain(p0, n0, p1, n1), F.cost(l), l))
    for l, n_every in fp_every.items():
        lit = "!" + l
        if lit in have or l in have or l.startswith(("kind:", "dv:", "dp:")):
            continue
        p1 = p0 - pos_every.get(l, 0)
        n1 = n0 - n_every
        if p1 > 0 and n1 < n0:
            out.append((_gain(p0, n0, p1, n1), F.cost(lit), lit))
    # one-sided thresholds that keep every explained failure
    names = None
    for sites in pos_hits.values():
        here = set()
        for s in sites:
            here.update(k for k, v in s.nums.items() if not (isinstance(v, float) and math.isnan(v)))
        names = here if names is None else names & here
    for name in ((names or ()) if thresholds else ()):
        if name in thr_names or name in NO_REFINE_NUMBERS:
            continue
        lo = min(min(s.nums[name] for s in sites if name in s.nums) for sites in pos_hits.values())
        hi = max(max(s.nums[name] for s in sites if name in s.nums) for sites in pos_hits.values())
        for lit in (f"ge:{name}:{_fmt(lo)}", f"le:{name}:{_fmt(hi)}"):
            n1 = sum(1 for sites in fp.values() if any(holds(lit, s) for s in sites))
            if n1 < n0:
                out.append((_gain(p0, n0, p0, n1), F.cost(lit), lit))
    out.sort(key=lambda t: (-t[0], t[1], t[2]))
    return out


def _narrow(hits: dict, lit: str) -> dict:
    out = {}
    for ex, sites in hits.items():
        keep = [s for s in sites if holds(lit, s)]
        if keep:
            out[ex] = keep
    return out


def _search_seed(kind: str, lit: str, problem: Problem) -> tuple[list[Candidate], Candidate | None]:
    seed_rule = Rule(kind, [lit])
    pos_hits = {}
    for ex in problem.pos:
        h = problem.explained(seed_rule, ex)
        if h:
            pos_hits[ex] = h
    if not pos_hits:
        return [], None
    scope, fence = scope_of(kind, [s for sites in pos_hits.values() for s in sites])
    rule = Rule(kind, (lit,) + scope, fence)
    fp_hits = problem.pool.hits(rule, "pass")
    done: list[Candidate] = []
    worst: Candidate | None = None

    def keep_unclean(r, ph, fh, trace, why):
        nonlocal worst
        if worst is None or (len(fh), -len(ph)) < (worst.false_alarms, -len(worst.covered)):
            worst = Candidate(r, scope, list(ph), len(fh), seed=lit)
            worst.trace = trace + [why]

    frontier = [(rule, pos_hits, fp_hits,
                 [f"seed {lit}, fenced to {' & '.join(scope) or (str(len(fence)) + ' place(s)' if fence else '(anywhere)')}"
                  f": explains {len(pos_hits)}, false alarms {len(fp_hits)}"])]
    expansions = 0
    while frontier and expansions < EXPANSIONS_PER_SEED:
        nxt = []
        for r, ph, fh, trace in frontier:
            if not fh:
                c = Candidate(r, scope, list(ph), 0, seed=lit)
                c.trace = trace
                done.append(c)
                continue
            spent = len([l for l in r.all if l not in scope])
            if spent >= budget(len(ph)):
                keep_unclean(r, ph, fh, trace, f"stopped: {len(ph)} failure(s) may not buy more than {budget(len(ph))} literal(s)")
                continue
            expansions += 1
            refs = _refinements(r, ph, fh, problem.pool.n_pass >= MIN_PASSING_FOR_THRESHOLD)
            if not refs:
                keep_unclean(r, ph, fh, trace, "no literal removes a false alarm: the vocabulary cannot separate these")
                continue
            for gain, _cost, add in refs[:BEAM]:
                np_, nf = _narrow(ph, add), _narrow(fh, add)
                if not np_:
                    continue
                nxt.append((r.with_(add), np_, nf,
                            trace + [f"+ {add}: explains {len(np_)}, false alarms {len(nf)} (gain {gain:.2f})"]))
        nxt.sort(key=lambda t: (len(t[2]) / max(1, len(t[1])), -len(t[1]), t[0].cost()))
        seen, frontier = set(), []
        for item in nxt:
            if item[0].key() not in seen:
                seen.add(item[0].key())
                frontier.append(item)
            if len(frontier) >= BEAM:
                break
    for r, ph, fh, trace in frontier:
        if not fh:
            c = Candidate(r, scope, list(ph), 0, seed=lit)
            c.trace = trace
            done.append(c)
        else:
            keep_unclean(r, ph, fh, trace, "search budget ended with false alarms left")
    return done, worst


def _prune(c: Candidate, problem: Problem) -> None:
    """Drop literals outside the fence that do no work."""
    rule = c.rule
    changed = True
    while changed:
        changed = False
        for lit in sorted((l for l in rule.all if l not in c.scope), key=lambda l: -F.cost(l)):
            smaller = rule.without(lit)
            if not smaller.tests():
                continue
            if problem.pool.false_alarm(smaller):
                continue
            if all(problem.explained(smaller, ex) for ex in c.covered):
                c.trace.append(f"pruned {lit}: no false alarm returns without it")
                rule = smaller
                changed = True
                break
    c.rule = rule
    if rule.any:
        # the list of places is redrawn around the failures the finished rule explains: no place stays on trust
        sites = [s for ex in problem.pos for s in problem.explained(rule, ex)]
        prefix = "at:" if rule.kind == "attr" else "n:"
        seen = sorted({l for s in sites for l in s.lits if l.startswith(prefix)})
        if seen and tuple(seen) != rule.any:
            if len(seen) == 1:
                c.rule = Rule(rule.kind, rule.all + (seen[0],), ())
                c.scope = c.scope + (seen[0],)
            else:
                c.rule = Rule(rule.kind, rule.all, seen)


def _seen_at(problem: Problem, c: Candidate) -> list[str]:
    seen = set()
    for ex in c.covered:
        for s in problem.explained(c.rule, ex):
            node = next((l[2:] for l in s.lits if l.startswith("n:")), "")
            seen.add(f"{node}@{s.attr}" if s.attr else (node or "(document)"))
    return sorted(seen)


def _intervals(problem: Problem, c: Candidate) -> list[dict]:
    """For each threshold: the stretch between the last value seen to pass and the first seen to fail. The rule's
    threshold sits at the failing end; nothing in between was tested."""
    out = []
    for lit in c.rule.all:
        if not lit.startswith(("ge:", "le:")):
            continue
        op, rest = lit.split(":", 1)
        name, theta = rest.rsplit(":", 1)
        theta = float(theta)
        vals = []
        for sites in problem.pool.hits(c.rule.without(lit), "pass").values():
            vals.extend(s.nums[name] for s in sites if name in s.nums)
        if op == "ge":
            side = [v for v in vals if v < theta]
            edge = max(side) if side else None
        else:
            side = [v for v in vals if v > theta]
            edge = min(side) if side else None
        out.append({"literal": lit, "number": name, "first_failing": theta, "last_passing": edge,
                    "untested": None if edge is None else sorted([edge, theta]), "passing_values_compared": len(vals)})
    return out


def _finish(problem: Problem, c: Candidate) -> None:
    pool = problem.pool
    c.seen_at = _seen_at(problem, c)
    c.intervals = _intervals(problem, c)
    c.gap = any(F.tier(l.lstrip("!")) == 4 for l in c.rule.all)
    strays: dict[str, int] = {}
    for ex in pool.hits(c.rule, "fail"):
        if ex.event.signature != problem.signature:
            strays[ex.event.signature] = strays.get(ex.event.signature, 0) + 1
    c.strays = dict(sorted(strays.items(), key=lambda kv: -kv[1]))
    core = c.core()
    if (c.scope or c.rule.any) and core:
        g = Rule(c.rule.kind, core)
        c.general = g
        c.general_false_alarms = len(pool.hits(g, "pass"))


def _incidental(rule: Rule) -> bool:
    """True when the rule's only tests are thresholds on numbers that move with almost any edit (file size, value
    length). Such a rule may be all the evidence allows, but it never goes ahead of a rule that names a cause."""
    tests = rule.tests()
    return bool(tests) and all(t.startswith(("ge:", "le:")) and t.split(":")[1] in INCIDENTAL_NUMBERS for t in tests)


def _shape(rule: Rule) -> tuple:
    """A rule with its threshold values and its list of places left out."""
    def bare(l):
        core = l.lstrip("!")
        return l.rsplit(":", 1)[0] if core.startswith(("ge:", "le:")) else l
    return (rule.kind, tuple(sorted(bare(l) for l in rule.all)))


def induce(problem: Problem, max_rules: int = 6, log=None) -> Induction:
    out = Induction(problem)
    say = out.log.append
    pool = problem.pool
    say(f"{len(problem.pos)} failure(s) to explain; the instrument passed {pool.n_pass} file(s) and failed "
        f"{len(pool.examples) - pool.n_pass} in all")
    twinless = sum(1 for ex in problem.pos if ex.diff is None)
    if twinless:
        say(f"{twinless} failure(s) have no known-good twin: any site may explain them, so their rules are weaker")
    passed = {ex.case.sha256 for ex in pool.examples if ex.event.outcome == "pass"}
    passed |= {id(ex.case) for ex in pool.examples if ex.event.outcome == "pass"}
    out.outside = [ex for ex in problem.pos if (ex.twin is not None and ex.twin.sha256 == ex.case.sha256)
                   or id(ex.case) in passed or ex.case.sha256 in passed]
    if out.outside:
        say(f"{len(out.outside)} failure(s) are byte-identical to a file the instrument passed: the cause is not in the "
            f"file (another input, or an instrument that does not repeat itself). No rule over the file can explain them")
    gone = set(map(id, out.outside))
    remaining = [ex for ex in problem.pos if id(ex) not in gone]
    searched: set[tuple] = set()
    cands: dict[tuple, Candidate] = {}
    unclean: list[Candidate] = []
    while remaining and len(out.candidates) < max_rules:
        sd = seeds(problem, remaining)
        out.n_seeds = max(out.n_seeds, len(sd))

        def seed_order(item):
            (kind, lit), n = item
            core = lit.lstrip("!")
            incidental = core.startswith(("ge:", "le:")) and core.split(":")[1] in INCIDENTAL_NUMBERS
            return (-n, incidental, F.tier(core) == 4, F.cost(lit), lit)

        todo = [k for k, _ in sorted(sd.items(), key=seed_order) if k not in searched][:SEEDS_PER_ROUND]
        for kind, lit in todo:
            searched.add((kind, lit))
            done, worst = _search_seed(kind, lit, problem)
            for c in done:
                _prune(c, problem)
                c.covered = [ex for ex in problem.pos if problem.explained(c.rule, ex)]
                k = c.rule.key()
                if k not in cands or len(c.trace) < len(cands[k].trace):
                    cands[k] = c
            if worst is not None:
                unclean.append(worst)
        rem = set(map(id, remaining))
        ranked = []
        for c in cands.values():
            c.newly = sum(1 for ex in c.covered if id(ex) in rem)
            if c.newly:
                if not c.breadth:
                    c.breadth = pool.breadth(Rule(c.rule.kind, c.core() or c.rule.all))
                ranked.append(c)
        if not ranked:
            break
        # a rule in real vocabulary always goes before a fingerprint, however many failures the fingerprint matches
        ranked.sort(key=lambda c: (max(c.rule.tier(), c.rule.guard_tier()) == 4, -c.newly, _incidental(c.rule),
                                   len(c.core()), c.breadth, c.rule.cost(), repr(c.rule)))
        best = ranked[0]
        if out.candidates and best.newly < max(2, math.ceil(0.05 * len(problem.pos))):
            break                      # a later rule must earn its place; what is left stays residue
        newly = {id(ex) for ex in best.covered if id(ex) in rem}
        best.alternates, shapes = [], {_shape(best.rule)}
        for c in ranked[1:]:
            # the same rule at another point of an untested stretch is not another reading of the evidence
            if newly <= set(map(id, c.covered)) and _shape(c.rule) not in shapes and len(best.alternates) < 8:
                shapes.add(_shape(c.rule))
                best.alternates.append(c.rule)
        _finish(problem, best)
        out.candidates.append(best)
        say(f"rule {len(out.candidates)}: {best.rule!r} explains {best.newly} more ({len(best.covered)} in all); "
            f"{len(best.alternates)} alternate(s) the receipts cannot rule out; seen at {', '.join(best.seen_at[:4])}"
            + (f"; strays into {sum(best.strays.values())} failure(s) with other signatures" if best.strays else ""))
        covered = set(map(id, best.covered))
        remaining = [ex for ex in remaining if id(ex) not in covered]
        del cands[best.rule.key()]
    out.residue = remaining
    if remaining:
        say(f"{len(remaining)} failure(s) left unexplained (residue)")
    unclean.sort(key=lambda c: (c.false_alarms / max(1, len(c.covered)), -len(c.covered)))
    out.unclean = unclean[:5]
    if log:
        for line in out.log:
            log(line)
    return out
