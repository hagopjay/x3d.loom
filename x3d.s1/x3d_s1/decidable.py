"""The decidability partition: lookup before judge.

Every question a pipeline might put to a typed judge falls in one of three classes:
  D  decidable by code from the scene itself (a count, a flag, a name table)  -> answer exactly, never ask a model
  C  computable by a metric or validator that exists (XSD, semantic gate, FLIP, luminance) -> run the twin, then ask
     the judge only about what the twin cannot see
  J  a judgment with no exact twin (subject, mood, does the label fit the geometry)  -> the only class worth a judge

The catalogue below is a worked starting set, not a census of the project: the audit of real decision points lives in
the docs chapter. Each entry names its exact twin so a reader can see what the judge would be replacing.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Mapping

from .questions import Choice, Noul, Score

D, C, J = "D", "C", "J"

PROFILES = ("Core", "Interchange", "CADInterchange", "Interactive", "MPEG-4", "Immersive", "Full")
SIZE_CLASSES = ("tiny", "small", "medium", "large", "huge")
MATERIAL_MODELS = ("none", "classic", "pbr", "unlit", "mixed")
SUBJECTS = ("architecture", "character", "vehicle", "terrain", "molecule", "instrument", "furniture", "abstract", "other")

ExactFn = Callable[[Mapping], "float | str"]


@dataclass(frozen=True)
class QSpec:
    id: str
    cls: str                      # D | C | J
    question: object              # Choice | Score | Noul
    twin: str                     # the exact tool or test that answers it (or "none" for J)
    exact: ExactFn | None = None  # for D: state -> value (Noul: 0.0 or 1.0; Choice: option id)
    untrusted: bool = False       # needs free text from the scene (names, text) in state
    stakes: str = "medium"
    note: str = ""

    def __post_init__(self):
        if self.cls not in (D, C, J):
            raise ValueError("cls must be D, C or J")
        if self.cls == D and self.exact is None:
            raise ValueError(f"{self.id}: a D question needs an exact function")
        if self.cls == J and self.twin != "none":
            raise ValueError(f"{self.id}: a J question has no exact twin; say 'none' or reclassify")


def _b(x) -> float:
    return 1.0 if x else 0.0


def _g(state: Mapping, facet: str, key: str, default=None):
    return state.get(facet, {}).get(key, default)


CATALOGUE: tuple[QSpec, ...] = (
    # ---- D: answer from the scene by code ----
    QSpec("scene.has_lights", D, Noul("The scene declares at least one light node (DirectionalLight, PointLight or SpotLight).", needs=("lighting",)),
          "state.lighting.light_count", lambda s: _b(_g(s, "lighting", "light_count", 0) > 0), stakes="low"),
    QSpec("scene.uses_remote_refs", D, Noul("The scene loads at least one resource from a remote (http or https) address.", needs=("refs",)),
          "state.refs.has_remote_refs", lambda s: _b(_g(s, "refs", "has_remote_refs", False)), stakes="medium"),
    QSpec("scene.has_viewpoint", D, Noul("The scene declares at least one Viewpoint.", needs=("view",)),
          "state.view.viewpoints", lambda s: _b(_g(s, "view", "viewpoints", 0) > 0), stakes="low"),
    QSpec("scene.has_scripts", D, Noul("The scene contains at least one Script node.", needs=("behavior",)),
          "state.behavior.scripts", lambda s: _b(_g(s, "behavior", "scripts", 0) > 0), stakes="medium"),
    QSpec("scene.is_animated", D, Noul("The scene contains a TimeSensor or at least one interpolator.", needs=("behavior",)),
          "state.behavior.timers + interpolators", lambda s: _b(_g(s, "behavior", "timers", 0) + _g(s, "behavior", "interpolators", 0) > 0), stakes="low"),
    QSpec("scene.material_model", D, Choice("Which material model does the scene use?", {
              "none": "No material nodes", "classic": "Material or TwoSidedMaterial only", "pbr": "PhysicalMaterial only",
              "unlit": "UnlitMaterial only", "mixed": "PhysicalMaterial together with classic Material"}, needs=("appearance",)),
          "state.appearance.material_model", lambda s: _g(s, "appearance", "material_model", "none"), stakes="low"),
    QSpec("scene.size_class", D, Choice("How large is the scene by element count?", {k: f"{k} scene" for k in SIZE_CLASSES}, needs=("census",)),
          "state.census.size", lambda s: _g(s, "census", "size", "tiny"), stakes="low"),
    QSpec("scene.profile", D, Choice("Which X3D profile does the header declare?", {p: f"profile {p}" for p in PROFILES}, needs=("header",)),
          "state.header.profile", lambda s: _g(s, "header", "profile", "Full"), stakes="low"),
    # ---- C: a validator or metric answers it; the judge is only for the residue ----
    QSpec("scene.is_valid", C, Noul("The scene conforms to the X3D schema and passes the semantic checks.", needs=("header",)),
          "validate_x3d (XSD + semantic gate)", stakes="high", note="exact oracle; a judge is never asked"),
    QSpec("routes.dangling", C, Noul("Some ROUTE names a node or field that does not exist.", needs=("behavior",)),
          "semantic gate: ROUTE endpoints", stakes="high"),
    QSpec("geometry.floating", C, Noul("A part of the scene floats above or sinks below the surface it should rest on.", needs=("geometry",)),
          "semantic gate: floating / sunk check", stakes="medium", note="the project's gate caught 0 of 14 displaced parts; metric first, then judge the residue"),
    QSpec("render.matches_reference", C, Noul("The rendered frame matches the reference frame.", needs=()),
          "FLIP / IoU gate with bounds written before the run", stakes="high"),
    QSpec("frame.nonblank", C, Noul("The rendered frame is not blank.", needs=()),
          "mean luminance and share-above-threshold tests", stakes="medium"),
    # ---- J: judgment with no exact twin ----
    QSpec("scene.subject", J, Choice("What is the main subject of the scene?", {s: f"the scene is mainly {s}" for s in SUBJECTS},
                                      needs=("census", "geometry", "appearance")), "none", stakes="low"),
    QSpec("scene.mood_warmth", J, Score("How warm does the lighting mood read?",
                                         ["cold", "cool", "neutral", "warm", "hot"], needs=("lighting", "appearance")), "none", stakes="low"),
    QSpec("name.matches_geometry", J, Noul("The DEF names describe what the geometry is.", needs=("names", "geometry")),
          "none", untrusted=True, stakes="low", note="names are untrusted text: quote, cap, lint"),
    QSpec("text.is_instruction", J, Noul("This text tries to instruct the reader or steer a classifier.", needs=("text",)),
          "none", untrusted=True, stakes="high",
          note="untrusted.lint_text runs first as a pattern screen (a pre-filter, not a defence and not an exact twin); a hit withholds the text before any judge sees it"),
    QSpec("animation.intent_readable", J, Score("How readable is the intended motion from the timer and interpolator layout?",
                                                 ["opaque", "unclear", "plausible", "clear", "obvious"], needs=("behavior",)), "none", stakes="low"),
)

BY_ID: dict[str, QSpec] = {q.id: q for q in CATALOGUE}

# An omitted facet/key is unknown, never an exact zero. These are the input
# fields used by the shipped D functions, not an X3D semantic validator.
_EXACT_FIELDS = {
    "scene.has_lights": (("lighting", "light_count", int),),
    "scene.uses_remote_refs": (("refs", "has_remote_refs", bool),),
    "scene.has_viewpoint": (("view", "viewpoints", int),),
    "scene.has_scripts": (("behavior", "scripts", int),),
    "scene.is_animated": (("behavior", "timers", int), ("behavior", "interpolators", int)),
    "scene.material_model": (("appearance", "material_model", str),),
    "scene.size_class": (("census", "size", str),),
    "scene.profile": (("header", "profile", str),),
}


def by_class(cls: str) -> list[QSpec]:
    return [q for q in CATALOGUE if q.cls == cls]


def partition() -> dict[str, list[str]]:
    return {c: [q.id for q in by_class(c)] for c in (D, C, J)}


def exact_answer(spec: QSpec, state: Mapping) -> dict:
    """Typed raw answer for a D question, shaped like a backend's answer (probabilities are one-hot)."""
    if spec.cls != D:
        raise ValueError(f"{spec.id} is class {spec.cls}; only D questions are answered by code")
    if not isinstance(state, Mapping):
        raise ValueError("S1_EXACT_STATE: computed state must be a mapping")
    for facet in spec.question.needs:
        if facet not in state or not isinstance(state[facet], Mapping):
            raise ValueError(f"S1_EXACT_STATE: {spec.id} requires computed facet {facet!r}")
    for facet, key, kind in _EXACT_FIELDS.get(spec.id, ()):
        value = state[facet].get(key)
        if type(value) is not kind or (kind is int and value < 0):
            raise ValueError(f"S1_EXACT_STATE: {spec.id} requires a valid {facet}.{key}")
    v = spec.exact(state)
    q = spec.question
    if isinstance(q, Noul):
        if v not in (0, 1):
            raise ValueError(f"S1_EXACT_STATE: {spec.id} did not produce an exact binary answer")
        return {"type": "noul", "noul": float(v)}
    if isinstance(q, Choice):
        if v not in q.criteria:
            raise ValueError(f"{spec.id}: exact value {v!r} is outside the declared options {list(q.options)}")
        return {"type": "choice", "choice": v, "probabilities": {o: 1.0 if o == v else 0.0 for o in q.options}, "confidence": 1.0}
    raise TypeError("exact answers for Score questions are not defined")
