"""Two-sided controls for loomkit, run under normal Python and `python -O`.

Each negative control must be rejected with its INTENDED diagnostic; any other exception counts as a
broken test, not a caught defect (Loomsong debrief section 12: IndexError is not a rejection).
A negative that passes raises SURVIVING_CONTROL. Fixtures are synthetic and labelled so.

  python3 -I kit/tests/test_gates.py          # runs both modes and writes kit/tests/last-run.json
"""
from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(KIT))

from loomkit import accept as acc  # noqa: E402
from loomkit import pagetraps, picture, receipt, sci, sweep, traps  # noqa: E402
from loomkit.core import GateError, candidate, sha256_file, write_witness  # noqa: E402

PROFILE = {"schema": "loom.profile/1", "name": "synthetic/test", "required": [
    {"witness": "grammar"}, {"witness": "traps"},
    {"witness": "behaviour", "allow": ["deferred"]},
    {"witness": "truth", "coverage": {"rows": True}}], "visible_not_run": ["eyes"]}


def expect(code: str, fn) -> dict:
    try:
        fn()
    except GateError as e:
        if e.code != code:
            raise RuntimeError(f"WRONG_DIAGNOSTIC: expected {code}, got {e.code}") from None
        return {"expected": code, "caught": e.code}
    raise RuntimeError(f"SURVIVING_CONTROL: {code}")


def fixture(td: Path) -> tuple[Path, Path, str]:
    root, ev = td / "cand", td / "evidence"
    (root / "gen").mkdir(parents=True)
    (root / "gen/build.py").write_text("print('synthetic generator')\n")
    (root / "world.x3d").write_text("<X3D version='4.0'><Scene/></X3D>\n")
    s = candidate(root)["sha256"]
    for n in ("grammar", "traps"):
        write_witness(ev, root, s, n, "pass", "C", {"tool": "synthetic"})
    write_witness(ev, root, s, "behaviour", "deferred", "L", {"tool": "synthetic"}, reason="static profile: no browser here")
    log = ev / "truth.log"; ev.mkdir(exist_ok=True); log.write_text("ok\n")
    write_witness(ev, root, s, "truth", "pass", "C", {"tool": "synthetic"}, coverage={"rows": True},
                  evidence=[{"path": "truth.log", "sha256": sha256_file(log)}])
    return root, ev, s


def edit(ev: Path, name: str, **changes) -> None:
    p = ev / f"{name}.json"; r = json.loads(p.read_text()); r.update(changes); p.write_text(json.dumps(r))


def acceptance_controls() -> list[dict]:
    rows = []
    with tempfile.TemporaryDirectory(prefix="loomkit-test-") as d:
        root, ev, s = fixture(Path(d))
        good = acc.accept(root, ev, PROFILE)
        if good["status"] != "accepted":
            raise RuntimeError("POSITIVE_CONTROL_REJECTED")
        rows.append({"case": "complete candidate", "result": "accepted"})
    cases = [
        ("missing witness", "MISSING_WITNESS", lambda r, e: (e / "traps.json").unlink()),
        ("red witness", "WITNESS_NOT_PASS", lambda r, e: edit(e, "grammar", status="fail")),
        ("instrument error", "WITNESS_NOT_PASS", lambda r, e: edit(e, "grammar", status="error")),
        ("not run", "WITNESS_NOT_PASS", lambda r, e: edit(e, "traps", status="not_run")),
        ("deferred without reason", "STATUS_NEEDS_REASON", lambda r, e: edit(e, "behaviour", reason="")),
        ("deferral not allowed", "WITNESS_NOT_PASS", lambda r, e: edit(e, "traps", status="deferred", reason="later")),
        ("stale: generator edited after witnesses", "STALE_WITNESS", lambda r, e: (r / "gen/build.py").write_text("print('changed')\n")),
        ("stale: new file added", "STALE_WITNESS", lambda r, e: (r / "extra.js").write_text("//\n")),
        ("development record", "DEVELOPMENT_WITNESS", lambda r, e: edit(e, "grammar", development=True)),
        ("pass graded S", "UNMEASURED_REQUIRED_WITNESS", lambda r, e: edit(e, "traps", grade="S")),
        ("coverage absent", "COVERAGE_REQUIRED", lambda r, e: edit(e, "truth", coverage={})),
        ("evidence edited", "EVIDENCE_DRIFT", lambda r, e: (e / "truth.log").write_text("edited\n")),
        ("wrong witness name", "WRONG_WITNESS_NAME", lambda r, e: edit(e, "grammar", witness="eyes")),
        ("malformed record", "MALFORMED_WITNESS", lambda r, e: (e / "traps.json").write_text("{not json")),
    ]
    for label, code, mutate in cases:
        with tempfile.TemporaryDirectory(prefix="loomkit-test-") as d:
            root, ev, s = fixture(Path(d))
            mutate(root, ev)
            rows.append({"case": label, **expect(code, lambda: acc.accept(root, ev, PROFILE))})
    with tempfile.TemporaryDirectory(prefix="loomkit-test-") as d:
        p = Path(d) / "empty.json"; p.write_text(json.dumps({"schema": "loom.profile/1", "name": "x", "required": []}))
        rows.append({"case": "empty profile", **expect("EMPTY_PROFILE", lambda: acc.load_profile(p))})
    with tempfile.TemporaryDirectory(prefix="loomkit-test-") as d:
        root, ev, s = fixture(Path(d))
        (root / "gen/build.py").write_text("print('changed mid-run')\n")
        rows.append({"case": "candidate changed during witness", **expect(
            "CANDIDATE_CHANGED_DURING_WITNESS", lambda: write_witness(ev, root, s, "eyes", "pass", "C", {}))})
    return rows


TRAP_CASES = {  # rule: (passing XML, failing XML). Synthetic fixtures.
    "shader-raw-source": ("<X3D version='4.0'><Scene><ShaderPart>data:x-shader/x-fragment,#version 300 es\nvoid main(){}</ShaderPart></Scene></X3D>",
                          "<X3D version='4.0'><Scene><ShaderPart>#version 300 es\nvoid main(){}</ShaderPart></Scene></X3D>"),
    "route-before-def": ("<X3D><Scene><TimeSensor DEF='T'/><Transform DEF='B'/><ROUTE fromNode='T' fromField='fraction_changed' toNode='B' toField='set_x'/></Scene></X3D>",
                         "<X3D><Scene><TimeSensor DEF='T'/><ROUTE fromNode='T' fromField='fraction_changed' toNode='B' toField='set_x'/><Transform DEF='B'/></Scene></X3D>"),
    "route-undefined": ("<X3D><Scene><TimeSensor DEF='T'/><Transform DEF='B'/><ROUTE fromNode='T' fromField='a' toNode='B' toField='b'/></Scene></X3D>",
                        "<X3D><Scene><TimeSensor DEF='T'/><ROUTE fromNode='T' fromField='a' toNode='Nope' toField='b'/></Scene></X3D>"),
    "color-range": ("<X3D><Scene><Material diffuseColor='1 0.5 0'/></Scene></X3D>",
                    "<X3D><Scene><Material diffuseColor='1.2 0.5 0'/></Scene></X3D>"),
    "color-emissive-white": ("<X3D><Scene><Material diffuseColor='0.9 0.1 0.1' emissiveColor='0.2 0 0'/></Scene></X3D>",
                             "<X3D><Scene><Material diffuseColor='0.9 0.1 0.1' emissiveColor='1 1 1'/></Scene></X3D>"),
    "splat-bbox": ("<X3D version='4.1'><Scene><GaussianSplats bboxSize='2 2 2' bboxCenter='0 0 0'/></Scene></X3D>",
                   "<X3D version='4.1'><Scene><GaussianSplats/></Scene></X3D>"),
    "movie-not-still": ("<X3D><Scene><MovieTexture url='\"clip.mp4\"'/></Scene></X3D>",
                        "<X3D><Scene><MovieTexture url='\"poster.png\"'/></Scene></X3D>"),
    "version-fits-nodes": ("<X3D version='4.1'><Scene><RenderedTexture/></Scene></X3D>",
                           "<X3D version='4.0'><Scene><RenderedTexture/></Scene></X3D>"),
    "no-script-under-host": ("<X3D><Scene><Transform/></Scene></X3D>", "<X3D><Scene><Script/></Scene></X3D>"),
    "metadata-containerfield": ("<X3D><Scene><Shape><MetadataSet containerField='metadata' name='row'/></Shape></Scene></X3D>",
                                "<X3D><Scene><Shape><MetadataSet name='row'/></Shape></Scene></X3D>"),
    "glsl-reserved-active": ("<X3D><Scene><ShaderPart>data:x-shader/x-fragment,in float sounding;void main(){}</ShaderPart></Scene></X3D>",
                             "<X3D><Scene><ShaderPart>data:x-shader/x-fragment,in float active;void main(){}</ShaderPart></Scene></X3D>"),
}


def trap_controls() -> list[dict]:
    if set(TRAP_CASES) != set(traps.RULES):
        raise RuntimeError("TRAP_RULE_WITHOUT_TWO_SIDED_TEST: " + str(set(traps.RULES) ^ set(TRAP_CASES)))
    rows = []
    for rule, (good, bad) in TRAP_CASES.items():
        prof = {"host": "strict"}
        g = [h.rule for h in traps.check(good.encode(), prof)]
        b = [h.rule for h in traps.check(bad.encode(), prof)]
        if rule in g:
            raise RuntimeError(f"FALSE_POSITIVE: {rule}")
        if rule not in b:
            raise RuntimeError(f"SURVIVING_CONTROL: {rule}")
        rows.append({"rule": rule, "passing_fixture": "clean", "failing_fixture": "caught"})
    return rows


# Page traps: a clean page and one failing page per rule. Fixtures are built from fragments so the kit's
# own sources stay free of the patterns they test for.
_CB = "nodes.seq.add" + "FieldCallback"
_LOAD = "  await Promise.race([B.load" + "URL(u), new Promise((_, r) => setTimeout(() => r(Error('timeout')), 3e4))]);\n"
_NAV = "  addEventListener(\"hash" + "change\", () => route());\n"
CLEAN_PAGE = ("const topOf = 1;\n// A comment may name the traps: Browser." + "currentTime is undefined; never call " + _NAV.strip() + " early.\n"
              "/* nor " + _CB + "(x, y, (v) => { show(v); }) */\nasync function main() {\n" + _LOAD +
              "  " + _CB + "(\"ui\", \"value_changed\", (v) => { try { show(v); } catch (e) { console.error(e); } });\n" + _NAV +
              "  const t = B.getCurrentTime();\n}\n")
PAGE_CASES = {
    "xite-callback-unguarded": CLEAN_PAGE.replace("{ try { show(v); } catch (e) { console.error(e); } }", "{ show(v); }"),
    "xite-browser-currenttime": CLEAN_PAGE.replace("B.getCurrentTime()", "B." + "currentTime"),
    "nav-before-scene": _NAV + CLEAN_PAGE.replace(_NAV, ""),
    "window-global-shadow": CLEAN_PAGE.replace("const topOf = 1;", "const t" + "op = 1;"),
    "loadurl-unbudgeted": CLEAN_PAGE.replace(_LOAD, "  await B.load" + "URL(u);\n"),
    "js-syntax": CLEAN_PAGE.replace("console.error(e); } });", "console.error(e); } }););"),
}


# Forms of the page the witness must read, each two-sided: a callback passed by name (the Mashtots slide
# show's `onFrame`, failure mode 93) and inline <script> blocks in HTML, with the HTML line reported.
_NAMED_OK = "function onFrame(e) { try { step(e); } catch (x) { console.error(x); } }\nclock." + _CB.split(".")[-1] + "(\"stage\", \"elapsedTime\", onFrame);\n"
_NAMED_BAD = "function onFrame(e) {\n  step(e);\n}\nclock." + _CB.split(".")[-1] + "(\"stage\", \"elapsedTime\", onFrame);\n"


def _html(js: str, attrs: str = ' type="module"') -> str:
    return ('<!doctype html>\n<title>t</title>\n<script src="vendor/x_ite.min.js"></script>\n'
            '<script type="x-shader/x-fragment">void main() { gl_FragColor = vec4(1); }</script>\n'
            f"<script{attrs}>\n{js}</script>\n")


PAGE_FORMS = [  # (label, rule, reader, passing source, failing source, expected line of the hit or None)
    ("callback passed by name", "xite-callback-unguarded", "js", _NAMED_OK, _NAMED_BAD, 4),
    ("inline module script", "xite-callback-unguarded", "html", _html(CLEAN_PAGE), _html(PAGE_CASES["xite-callback-unguarded"]), 11),
    ("inline classic script", "window-global-shadow", "html", _html(CLEAN_PAGE, ""), _html(PAGE_CASES["window-global-shadow"], ""), 6),
    ("inline script syntax", "js-syntax", "html", _html(CLEAN_PAGE), _html(PAGE_CASES["js-syntax"]), 11),
    # a module's top-level names never reach window (the first HTML run flagged a module's `frames`)
    ("module scope is not window", "window-global-shadow", "html", _html(PAGE_CASES["window-global-shadow"]),
     _html(PAGE_CASES["window-global-shadow"], ""), 6),
    ("ES module .js file", "window-global-shadow", "js", "export const x = 1;\n" + PAGE_CASES["window-global-shadow"],
     PAGE_CASES["window-global-shadow"], 1),
]


def page_controls() -> list[dict]:
    rows = page_rule_controls()
    for label, rule, reader, good, bad, line in PAGE_FORMS:
        run = pagetraps.check_html if reader == "html" else pagetraps.check
        g = [h for h in run(good) if h.rule == rule]
        b = [h for h in run(bad) if h.rule == rule and h.severity == "error"]
        if g:
            raise RuntimeError(f"FALSE_POSITIVE ({label}): {[h.__dict__ for h in g]}")
        if not b:
            raise RuntimeError(f"SURVIVING_CONTROL ({label}): {rule}")
        if line is not None and b[0].where != f"<page>:{line}":
            raise RuntimeError(f"WRONG_LINE ({label}): {b[0].where}, expected <page>:{line}")
        rows.append({"form": label, "rule": rule, "passing_fixture": "clean", "failing_fixture": "caught"})
    seen = pagetraps.inventory(pagetraps.scripts_view(_html(CLEAN_PAGE)))
    if seen != {"field_callbacks": 1, "world_loads": 1}:
        raise RuntimeError(f"INVENTORY: {seen}")
    if pagetraps.inventory(pagetraps.scripts_view(_html("const a = 1;\n"))) != {"field_callbacks": 0, "world_loads": 0}:
        raise RuntimeError("INVENTORY counts code outside inline scripts")
    rows.append({"case": "inventory counts what was read, and only that", "result": "exact"})
    return rows


def page_rule_controls() -> list[dict]:
    if set(PAGE_CASES) != set(pagetraps.RULES):
        raise RuntimeError("PAGE_RULE_WITHOUT_TWO_SIDED_TEST: " + str(set(pagetraps.RULES) ^ set(PAGE_CASES)))
    clean = [h.rule for h in pagetraps.check(CLEAN_PAGE)]
    if clean:
        raise RuntimeError(f"FALSE_POSITIVE on the clean page: {clean}")
    rows = []
    for rule, bad in PAGE_CASES.items():
        if rule not in [h.rule for h in pagetraps.check(bad)]:
            raise RuntimeError(f"SURVIVING_CONTROL: {rule}")
        rows.append({"rule": rule, "passing_fixture": "clean", "failing_fixture": "caught"})
    return rows


def picture_controls() -> list[dict]:
    s, frames = "a" * 64, {"shot-01": "b" * 64, "shot-02": "c" * 64}
    good = {"schema": "loom.picture-review/1", "subject_sha256": s, "reviewer": "synthetic fixture", "state": "suspected",
            "images": dict(frames), "flags": [{"id": "f1", "view": "shot-01", "region": [0.1, 0.1, 0.6, 0.5],
                                               "concern": "Collar floats above the left post; seat it.", "state": "suspected"}],
            "scope": "protocol test only"}
    picture.validate(good, s, frames)
    rows = [{"case": "located suspected flag", "result": "accepted"}]
    muts = [("score field", "PICTURE_FIELDS", lambda r: r.update(score=9)),
            ("score in prose", "PICTURE_GRADING", lambda r: r.update(scope="overall 7/10")),
            ("confirmed state", "MODEL_TRUTH_PROMOTION", lambda r: r.update(state="confirmed")),
            ("flag promoted", "MODEL_TRUTH_PROMOTION", lambda r: r["flags"][0].update(state="confirmed")),
            ("stale review", "STALE_PICTURE_REVIEW", lambda r: r.update(subject_sha256="d" * 64)),
            ("missing view", "PICTURE_COVERAGE", lambda r: r["images"].pop("shot-02")),
            ("wrong image", "PICTURE_IMAGE_BINDING", lambda r: r["images"].update({"shot-01": "e" * 64})),
            ("bad region", "PICTURE_REGION", lambda r: r["flags"][0].update(region=[0.9, 0.1, 0.2, 0.5])),
            ("vague concern", "PICTURE_CONCERN", lambda r: r["flags"][0].update(concern="bad")),
            ("duplicate flag", "PICTURE_DUPLICATE", lambda r: r["flags"].append(dict(r["flags"][0])))]
    for label, code, m in muts:
        r = copy.deepcopy(good); m(r)
        rows.append({"case": label, **expect(code, lambda: picture.validate(r, s, frames))})
    return rows


def receipt_controls() -> list[dict]:
    rows = []
    with tempfile.TemporaryDirectory(prefix="loomkit-test-") as d:
        root, ev, s = fixture(Path(d))
        result = acc.accept(root, ev, PROFILE)
        r = receipt.build("synthetic", result, candidate(root)["files"], [root / "world.x3d"], {}, {}, [], [], {}, None, [])
        dest = Path(d) / "receipts/synthetic.json"
        receipt.write(r, dest)
        receipt.verify(dest)
        rows.append({"case": "write and verify", "result": "intact"})
        rows.append({"case": "overwrite refused", **expect("RECEIPT_EXISTS", lambda: receipt.write(r, dest))})
        t = json.loads(dest.read_text()); t["grade"] = "S"; dest.write_text(json.dumps(t))
        rows.append({"case": "edited receipt", **expect("RECEIPT_DRIFT", lambda: receipt.verify(dest))})
    return rows


def sweep_controls() -> list[dict]:
    # Leak words are assembled from fragments so this file itself passes the sweep, and the rule set is
    # inline so the public copy (which omits kit/profiles/public-sweep.json) can still run this test.
    vendor, host, cost, other, home = "Gem" + "ini", "cla" + "ude" + ".ai", "$" + "36.16", "Open" + "AI", "/Us" + "ers/"
    rules = {"schema": "loom.sweep-rules/1",
             "replace": [{"pattern": vendor, "with": "a hosted model"}, {"pattern": host.replace(".", "\\."), "with": "the hosting app"},
                         {"pattern": r"(?<![\w\"])\$\d[\d,]*(?:\.\d+)?", "with": "[cost withheld]"}],
             "forbid": [vendor, other, host.replace(".", "\\."), home + "[A-Za-z0-9_-]+", r"(?<![\w\"'])\$\d[\d,]*\.\d{2}"]}
    rows = []
    with tempfile.TemporaryDirectory(prefix="loomkit-test-") as d:
        src, dst = Path(d) / "src", Path(d) / "dst"; src.mkdir()
        (src / "a.md").write_text(f"Judged by {vendor} judge for {cost}; see {host}; run.sh uses \"$0\".\n")
        rep = sweep.sweep(src, dst, rules, set())
        out = (dst / "a.md").read_text()
        if rep["status"] != "pass" or vendor in out or cost in out or '"$0"' not in out:
            raise RuntimeError("SWEEP_POSITIVE_FAILED: " + out)
        rows.append({"case": "vendor, cost and host removed; shell positional argument kept", "result": "clean"})
        (src / "b.md").write_text("Also tried " + other + " and " + home + "someone/x.\n")
        rep = sweep.sweep(src, dst, rules, set())
        if rep["status"] != "fail" or len(rep["residue"]) != 2:
            raise RuntimeError("SURVIVING_CONTROL: LEAK_RESIDUE")
        rows.append({"case": "uncovered leak reported as residue", "expected": "LEAK_RESIDUE", "caught": "LEAK_RESIDUE"})
    return rows


def sci_bank(td: Path) -> tuple[Path, dict]:
    """A synthetic two-frame 'wave' case bank (labelled synthetic) in loom.scientific-case/1 form."""
    import hashlib
    root = td / "bank"; (root / "cases/wave/a").mkdir(parents=True); (root / "tools").mkdir()
    (root / "tools/wave.py").write_text("# synthetic builder\n")
    png = b"\x89PNG\r\n\x1a\n" + b"synthetic" + b"\x00\x00\x00\x00IEND\xaeB`\x82"
    frames = []
    for i in range(2):
        f = root / f"cases/wave/a/frame-{i}.png"; f.write_bytes(png)
        frames.append({"file": f"cases/wave/a/frame-{i}.png", "sha256": hashlib.sha256(png).hexdigest(), "bytes": len(png),
                       "time": float(i), "clipped_values": 0, "quantization_max": 0.001})
    case = {"schema": "loom.scientific-case/1", "id": "wave/a", "kind": "wave", "equation": "u_tt = c^2 Laplacian(u) (synthetic)",
            "domain": {"shape": [8, 8, 8], "units": "dimensionless", "boundary": "periodic"}, "parameters": {"c": 1.0},
            "limits": ["Synthetic fixture for gate tests; no physical claim is made."], "frames": frames,
            "witnesses": [{"id": "energy drift", "pass": True, "observed": 1e-9, "limit": 1e-6, "rule": "at most"},
                          {"id": "analytic reference error", "pass": True, "observed": 1e-4, "limit": 1e-3, "rule": "at most"},
                          {"id": "temporal refinement ratio", "pass": True, "observed": 0.25, "limit": 0.35, "rule": "at most"},
                          {"id": "display clipping", "pass": True, "observed": 0.0, "limit": 0.0, "rule": "at most"}],
            "builder_sha256": hashlib.sha256(b"# synthetic builder\n").hexdigest(),
            "dependencies": {"tools/solver.py": hashlib.sha256(b"# synthetic solver\n").hexdigest()}}
    (root / "tools/solver.py").write_text("# synthetic solver\n")
    import zlib
    raw = b"synthetic field " * 8
    blob = root / "cases/wave/a/field-0.bin"; blob.write_bytes(zlib.compress(raw))
    frames.append({"file": "cases/wave/a/field-0.bin", "sha256": hashlib.sha256(blob.read_bytes()).hexdigest(),
                   "bytes": blob.stat().st_size, "decoded_sha256": hashlib.sha256(raw).hexdigest(), "time": 2.0,
                   "clipped_values": 0, "quantization_max": 0.001})
    (root / "cases/wave/a/case.json").write_text(json.dumps(case))
    prof = {"science": {"min_cases": 1, "min_witnesses": 3, "quantization_max": 1 / 510, "builders": {"wave": "tools/wave.py"},
                        "kinds": {"wave": {"evolving": True, "required_witnesses": ["energy", "analytic reference", "refinement"]}}}}
    return root, prof


def sci_controls() -> list[dict]:
    rows = []
    with tempfile.TemporaryDirectory(prefix="loomkit-test-") as d:
        root, prof = sci_bank(Path(d)); sci.check_bank(root, prof)
        rows.append({"case": "synthetic case bank", "result": "accepted"})
    def edit_case(root, fn):
        p = root / "cases/wave/a/case.json"; c = json.loads(p.read_text()); fn(c); p.write_text(json.dumps(c))
    def truncate(root):
        import hashlib
        f = root / "cases/wave/a/frame-1.png"; b = f.read_bytes()[:-12]; f.write_bytes(b)
        edit_case(root, lambda c: c["frames"][1].update(bytes=len(b), sha256=hashlib.sha256(b).hexdigest()))
    def swap_blob(root):
        import hashlib, zlib
        f = root / "cases/wave/a/field-0.bin"; b = zlib.compress(b"other bytes"); f.write_bytes(b)
        edit_case(root, lambda c: c["frames"][2].update(bytes=len(b), sha256=hashlib.sha256(b).hexdigest()))
    muts = [("false green", "SCI_FALSE_GREEN", lambda r: edit_case(r, lambda c: c["witnesses"][0].update(observed=1.0))),
            ("failing witness, honestly red", "SCI_WITNESS_FAIL", lambda r: edit_case(r, lambda c: c["witnesses"][0].update(observed=1.0, **{"pass": False}))),
            ("passing numbers marked red", "SCI_FALSE_RED", lambda r: edit_case(r, lambda c: c["witnesses"][0].update(**{"pass": False}))),
            ("reference control dropped", "SCI_REQUIRED_WITNESS_MISSING", lambda r: edit_case(r, lambda c: c.update(witnesses=[w for w in c["witnesses"] if "analytic" not in w["id"]]))),
            ("time runs backwards", "SCI_TIME_ORDER", lambda r: edit_case(r, lambda c: c["frames"][1].update(time=0.0))),
            ("clipped display values", "SCI_DISPLAY_CLIPPING", lambda r: edit_case(r, lambda c: c["frames"][0].update(clipped_values=3))),
            ("coarse quantisation", "SCI_DISPLAY_QUANTIZATION", lambda r: edit_case(r, lambda c: c["frames"][0].update(quantization_max=0.03))),
            ("payload edited", "SCI_PAYLOAD_SIZE", lambda r: (r / "cases/wave/a/frame-0.png").write_bytes(b"tampered")),
            ("truncated PNG, rehashed", "SCI_PUBLICATION_UNDECODABLE", truncate),
            ("builder changed after build", "SCI_STALE_BUILDER", lambda r: (r / "tools/wave.py").write_text("# edited\n")),
            ("solver module changed after build", "SCI_STALE_DEPENDENCY", lambda r: (r / "tools/solver.py").write_text("# edited\n")),
            ("dependency outside the candidate", "SCI_STALE_DEPENDENCY", lambda r: edit_case(r, lambda c: c["dependencies"].update({"../outside.py": "0" * 64}))),
            ("deflated payload swapped, rehashed", "SCI_PUBLICATION_UNDECODABLE", swap_blob),
            ("no stated limitation", "SCI_MODEL_SCOPE", lambda r: edit_case(r, lambda c: c.update(limits=[]))),
            ("nonfinite observation", "SCI_WITNESS_NONFINITE", lambda r: edit_case(r, lambda c: c["witnesses"][1].update(observed=float("inf"))))]
    for label, code, m in muts:
        with tempfile.TemporaryDirectory(prefix="loomkit-test-") as d:
            root, prof = sci_bank(Path(d)); m(root)
            rows.append({"case": label, **expect(code, lambda: sci.check_bank(root, prof))})
    return rows


def run_all() -> dict:
    return {"acceptance": acceptance_controls(), "traps": trap_controls(),
            "picture": picture_controls(), "receipt": receipt_controls(), "sweep": sweep_controls(), "sci": sci_controls(),
            "pagetraps": page_controls(), "optimized": bool(sys.flags.optimize)}


if __name__ == "__main__":
    if "--child" in sys.argv:
        print(json.dumps(run_all()))
        sys.exit(0)
    report = {"schema": "loomkit.self-test/1", "scope": "Synthetic fixtures exercising the real predicates; not a project run.", "modes": []}
    for flags in ([], ["-O"]):
        p = subprocess.run([sys.executable, "-I", *flags, __file__, "--child"], capture_output=True, text=True)
        if p.returncode != 0:
            print(p.stdout, p.stderr, file=sys.stderr)
            sys.exit(1)
        res = json.loads(p.stdout)
        negatives = sum(1 for k in ("acceptance", "picture", "receipt", "sweep", "sci") for row in res[k] if "caught" in row)
        report["modes"].append({"optimized": res["optimized"], "negative_controls_caught": negatives,
                                "trap_rules_two_sided": len(res["traps"]),
                                "page_trap_rules_two_sided": sum(1 for r in res["pagetraps"] if "rule" in r and "form" not in r),
                                "page_trap_forms_two_sided": sum(1 for r in res["pagetraps"] if "form" in r), "detail": res})
    out = KIT / "tests/last-run.json"
    out.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    for m in report["modes"]:
        print(f"optimized={m['optimized']}: {m['negative_controls_caught']} negative controls caught with the intended code; "
              f"{m['trap_rules_two_sided']} trap rules, {m['page_trap_rules_two_sided']} page-trap rules and {m['page_trap_forms_two_sided']} page forms "
              "(named callback, inline HTML scripts, module scope) pass their clean fixture and catch their failing one")
