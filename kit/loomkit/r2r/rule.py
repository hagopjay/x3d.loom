"""The rule language: one site, a handful of literals, all of which must hold.

    Rule(kind="attr", all=("tc:bool", "v:bool_noncanonical", "!v:empty"))

reads: "at one attribute: the field holds a bool, AND a boolean is spelt as something other than true or false, AND NOT
the value is empty". A rule may also carry one OR-group (`any`), used when the evidence cannot tell alternatives apart.
A literal starting `ge:` or `le:` compares one of the site's numbers with a threshold.

The language is deliberately this small. Every rule can be read aloud, checked by hand against a file, and run by forty
lines of code; a candidate that needs more than this language says so (see "vocabulary gap" in induce.py) and waits for
a person or a proposer to name the missing idea.
"""
from __future__ import annotations

import hashlib
import json

from . import features as F


def _split_threshold(lit: str) -> tuple[str, str, float]:
    op, rest = lit.split(":", 1)
    name, theta = rest.rsplit(":", 1)
    return op, name, float(theta)


def holds(lit: str, site) -> bool:
    if lit.startswith("!"):
        return not holds(lit[1:], site)
    if lit.startswith(("ge:", "le:")):
        op, name, theta = _split_threshold(lit)
        v = site.nums.get(name)
        if v is None:
            return False
        return v >= theta if op == "ge" else v <= theta
    return lit in site.lits


class Rule:
    __slots__ = ("kind", "all", "any", "_pos", "_neg", "_thr", "_nthr", "_any")

    def __init__(self, kind: str, all=(), any=()):
        self.kind = kind
        order = {"test": 0, "guard": 1, "context": 2}
        self.all = tuple(sorted(set(all), key=lambda l: (order[F.role(l)], l)))
        self.any = tuple(sorted(set(any)))
        pos, neg, thr, nthr = {"kind:" + kind}, set(), [], []
        for lit in self.all:
            core = lit[1:] if lit.startswith("!") else lit
            if core.startswith(("ge:", "le:")):
                (nthr if lit.startswith("!") else thr).append(_split_threshold(core))
            elif lit.startswith("!"):
                neg.add(core)
            else:
                pos.add(lit)
        self._pos, self._neg, self._thr, self._nthr = frozenset(pos), frozenset(neg), tuple(thr), tuple(nthr)
        self._any = self.any

    # --- matching -------------------------------------------------------------------------------------------------
    def matches(self, site) -> bool:
        lits = site.lits
        if not self._pos <= lits or (self._neg and not self._neg.isdisjoint(lits)):
            return False
        for op, name, theta in self._thr:
            v = site.nums.get(name)
            if v is None or not (v >= theta if op == "ge" else v <= theta):
                return False
        for op, name, theta in self._nthr:
            v = site.nums.get(name)
            if v is not None and (v >= theta if op == "ge" else v <= theta):
                return False
        if self._any and not any(holds(l, site) for l in self._any):
            return False
        return True

    def hits(self, site_list) -> list:
        return [s for s in site_list if self.matches(s)]

    def fires(self, site_list) -> bool:
        return any(self.matches(s) for s in site_list)

    def could_fire(self, bag_lits: frozenset) -> bool:
        """A cheap no: the document holds every positive literal somewhere. Yes here is not yes for the rule."""
        return (self._pos - {"kind:" + self.kind}) <= bag_lits

    # --- structure ------------------------------------------------------------------------------------------------
    def with_(self, lit: str) -> "Rule":
        return Rule(self.kind, self.all + (lit,), self.any)

    def without(self, lit: str) -> "Rule":
        return Rule(self.kind, tuple(l for l in self.all if l != lit), self.any)

    def tests(self) -> list[str]:
        return [l for l in self.all if F.role(l) == "test"]

    def context(self) -> list[str]:
        return [l for l in self.all if F.role(l) == "context"]

    def guards(self) -> list[str]:
        return [l for l in self.all if F.role(l) == "guard"]

    def tier(self) -> int:
        """The highest tier among the literals that make the rule's case. 4 means it leans on a literal value."""
        t = [F.tier(l) for l in self.all if not l.startswith("!") and F.tier(l) > 0]
        return max(t) if t else 0

    def guard_tier(self) -> int:
        t = [F.tier(l) for l in self.all if l.startswith("!")]
        return max(t) if t else 0

    def cost(self) -> float:
        c = sum(F.cost(l) for l in self.all)
        if self.any:
            c += min(F.cost(l) for l in self.any) + 0.05 * len(self.any)
        return round(c, 3)

    def key(self) -> tuple:
        return (self.kind, self.all, self.any)

    def __eq__(self, other):
        return isinstance(other, Rule) and self.key() == other.key()

    def __hash__(self):
        return hash(self.key())

    def __repr__(self):
        body = " & ".join(self.all)
        if self.any:
            body += (" & " if body else "") + "(" + " | ".join(self.any) + ")"
        return f"{self.kind}[{body}]"

    # --- serialisation --------------------------------------------------------------------------------------------
    def to_json(self) -> dict:
        d = {"kind": self.kind, "all": list(self.all)}
        if self.any:
            d["any"] = list(self.any)
        return d

    @classmethod
    def from_json(cls, d: dict) -> "Rule":
        return cls(d["kind"], d.get("all", ()), d.get("any", ()))

    def rid(self) -> str:
        """A short content address: the same rule has the same id on every machine."""
        raw = json.dumps(self.to_json(), sort_keys=True, separators=(",", ":")).encode()
        return "r2r-" + hashlib.sha256(raw).hexdigest()[:12]

    def sentence(self) -> str:
        where = {"attr": "At one attribute", "elem": "At one element", "doc": "For the file as a whole"}[self.kind]
        ctx = [F.describe(l) for l in self.context()]
        tst = [F.describe(l) for l in self.all if F.role(l) == "test"]
        grd = [F.describe(l[1:]) for l in self.guards()]
        text = where
        if ctx:
            text += " where " + " and ".join(ctx)
        if tst:
            text += ": " + " and ".join(tst)
        if self.any:
            places = [l.split(":", 1)[1].replace("@", " ") for l in self.any]
            text += f", at one of {len(places)} places ({', '.join(places)})"
        if grd:
            text += ", unless " + " or ".join(grd)
        return text + "."
