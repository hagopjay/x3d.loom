"""The harness must have a working control and fail for the intended reason."""
import importlib.util
from pathlib import Path


def harness():
    source = Path(__file__).resolve().parents[1] / "tools/mutation_check.py"
    spec = importlib.util.spec_from_file_location("mutation_harness_under_test", source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_copied_control_preserves_receipts_needed_by_drift_tests(tmp_path):
    module = harness()
    source = tmp_path / "source"
    (source / "receipts").mkdir(parents=True)
    (source / "receipts/corpus.json").write_text('{"fixture": true}')
    (source / "__pycache__").mkdir()
    (source / "__pycache__/unused.pyc").write_bytes(b"unused")
    module._copy_project(str(source), str(tmp_path / "copy"))
    assert (tmp_path / "copy/receipts/corpus.json").read_text() == '{"fixture": true}'
    assert not (tmp_path / "copy/__pycache__").exists()


def test_only_named_behavioral_failures_count_as_kills():
    module = harness()
    run = {"returncode": 1, "failed_tests": ["tests.test_x::test_expected"], "error_tests": []}
    assert module.classify(run, ["test_expected"]) == "killed"
    assert module.classify(run, ["test_other"]) == "UNRELATED_FAILURE"


def test_collection_errors_and_harness_crashes_are_not_kills():
    module = harness()
    run = {"returncode": 1, "failed_tests": ["test_expected"], "error_tests": ["test_import"]}
    assert module.classify(run, ["test_expected"]) == "INVALID_RUN"
    run = {"returncode": None, "failed_tests": [], "error_tests": [], "harness_error": "TimeoutExpired"}
    assert module.classify(run, ["test_expected"]) == "INVALID_RUN"


def test_passing_mutant_is_a_survivor():
    assert harness().classify({"returncode": 0, "failed_tests": [], "error_tests": []}, ["test_expected"]) == "SURVIVED"


def test_red_unmutated_copy_refuses_to_measure_mutations(tmp_path, monkeypatch):
    module = harness()
    source = tmp_path / "project"
    source.mkdir()
    (source / "input.txt").write_text("control")
    monkeypatch.setattr(module, "ROOT", str(source))
    calls = []
    def run(path):
        calls.append(path)
        return {"returncode": 0 if len(calls) == 1 else 1, "failed_tests": [], "error_tests": []}
    monkeypatch.setattr(module, "run_tests", run)
    assert module.main() == 2 and len(calls) == 2
    assert not (source / "receipts/mutation-hardening.json").exists()


def test_snapshot_identity_changes_when_test_or_instrument_changes(tmp_path):
    module = harness()
    (tmp_path / "test.py").write_text("assert 1")
    before = module.snapshot_hash(str(tmp_path))
    (tmp_path / "test.py").write_text("assert 2")
    assert module.snapshot_hash(str(tmp_path)) != before


def test_every_mutant_has_named_tests_and_every_name_is_a_real_test():
    import re
    module = harness()
    labels = [label for _, label, _, _ in module.MUTANTS]
    assert len(labels) == len(set(labels)), "mutant labels must be unique"
    assert set(labels) == set(module.EXPECTED_TESTS), "every mutant needs named tests, and no entry may be orphaned"
    defined = set()
    for path in (Path(__file__).resolve().parent).glob("test_*.py"):
        defined.update(re.findall(r"^def (test_\w+)", path.read_text(encoding="utf-8"), flags=re.M))
    stale = {name for names in module.EXPECTED_TESTS.values() for name in names if name not in defined}
    assert stale == set(), f"EXPECTED_TESTS names that do not exist: {sorted(stale)}"
