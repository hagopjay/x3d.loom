"""The exact metric DSPy needs: the fork validator as a scored, explained function.
Validator: hagopjay/x3d_mcp commit d5598c4 (XSD for the declared version + semantic checker incl. profile/components).
score: 1.0 valid; otherwise 0.0. feedback: the validator's own error text (what GEPA reflects on)."""
import os, re, sys, signal
TREE = os.environ.get("X3D_MCP_TREE", "/tmp/fork")
sys.path[0:0] = [os.path.join(TREE, "src"), TREE]
from validation.validate import validate_xml      # noqa: E402
from validation.semantic import validate_semantic  # noqa: E402

def extract_x3d(text):
    text = text or ""
    m = re.search(r"<X3D[\s>].*?</X3D>", text, re.S)
    return m.group(0) if m else re.sub(r"^```\w*\n|```\s*$", "", text.strip())

def check(text):
    xml = extract_x3d(text)
    x = validate_xml(xml)
    sem = validate_semantic(xml)
    sem_errs = [l for l in sem.split("## Warnings")[0].splitlines() if l.startswith("- **[")] if "## Errors" in sem else []
    full = os.environ.get("X3D_NO_FULL") == "1" and re.search(r"<X3D[^>]*profile=['\"]Full['\"]", xml)
    if full: sem_errs = ["- **[profile-full-not-allowed]** profile='Full' dodges the component check; use Immersive or Interchange and declare the needed <component> statements in <head>"] + sem_errs
    sec = re.search(r"## Errors\n(.*?)(?=\n## |\Z)", sem, re.S)   # strict: error-level lines only (infos like unused-def / profile-component-fix follow them)
    sem_only = [l for l in (sec.group(1).splitlines() if sec else []) if l.startswith("- **[")][:12]
    return {"sem_err_only": sem_only, "valid": bool(x.get("valid")) and not sem_errs, "xsd_valid": bool(x.get("valid")),
            "xsd_errors": x.get("errors", [])[:12], "sem_errors": sem_errs[:12], "notes": x.get("notes", [])}

def _hint(line):
    """HINT_VARIANT experiment: how the validator WORDS its fix steers an optimiser. default = the fork's own text (mentions Full)."""
    v = os.environ.get("HINT_VARIANT", "default")
    if "[profile-component-fix]" not in line or v == "default": return line
    head = line.split(" -- or raise the profile")[0]
    if v == "nofullhint": return head + "."
    if v == "prefer": return head + ". Preferred fix: keep the declared profile and add these component statements; raising the profile to Full hides what the scene needs and is discouraged."
    return line

def report(r):
    if r["valid"]: return "valid"
    return "XSD errors:\n" + ("\n".join(r["xsd_errors"]) or "none") + "\nSemantic errors:\n" + ("\n".join(_hint(l) for l in r["sem_errors"]) or "none")

def metric(example, pred, trace=None, pred_name=None, pred_trace=None):
    """dspy metric (also GEPA-compatible: returns score + feedback)."""
    import dspy
    r = check(getattr(pred, "x3d", ""))
    return dspy.Prediction(score=1.0 if r["valid"] else 0.0, feedback=report(r))
