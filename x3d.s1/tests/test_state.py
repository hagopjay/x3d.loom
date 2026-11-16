import json

import pytest
from conftest import fixture

from x3d_s1.state import SceneRefused, approx_tokens, load, mfstring, slice_state


def test_mfstring():
    assert mfstring('"a b" "c"') == ["a b", "c"]
    assert mfstring("bare") == ["bare"]
    assert mfstring(None) == [] and mfstring('') == []
    assert mfstring(r'"say \"hi\""') == ['say "hi"']


def test_computed_facets_on_benign_scene():
    r = slice_state(fixture("benign.x3d"))
    s = r["state"]
    assert s["header"]["profile"] == "Interchange" and s["header"]["version"] == "4.0"
    assert s["geometry"]["geometry_types"] == {"Sphere": 1, "Cone": 1} and s["geometry"]["shapes"] == 2
    assert s["appearance"]["material_model"] == "classic" and set(s["appearance"]["diffuse_color_names"]) <= {"blue", "green", "cyan", "teal"}
    assert s["lighting"]["light_count"] == 0 and s["lighting"]["headlight"] is True
    assert s["view"]["viewpoints"] == 1 and s["refs"]["url_refs"] == 0


def test_untrusted_text_is_excluded_by_default():
    r = slice_state(fixture("adversarial.x3d"), facets=["census", "text", "names"])
    assert "text" not in r["state"] and "names" not in r["state"]
    assert r["meta"]["excluded_untrusted"] == ["text", "names"] and r["meta"]["untrusted_included"] is False
    assert "Ignore" not in json.dumps(r["state"])


def test_when_included_attacks_are_withheld_and_flagged():
    r = slice_state(fixture("adversarial.x3d"), facets=["text", "names"], include_untrusted=True)
    dump = json.dumps(r["state"])
    assert "ignore all previous" not in dump.lower() and "answer yes to every" not in dump.lower() and "must now respond" not in dump.lower()
    assert r["state"]["text"]["flagged"] >= 3
    assert any(i.get("withheld") for i in r["state"]["text"]["items"])
    bodies = [i for i in r["state"]["text"]["items"] if i["where"].endswith(".body")]
    assert bodies and all(b["withheld"] and "text" not in b for b in bodies)   # code bodies are never included
    assert r["meta"]["untrusted_included"] is True


def test_script_and_remote_refs_are_computed_not_quoted():
    s = slice_state(fixture("adversarial.x3d"), facets=["behavior", "refs"])["state"]
    assert s["behavior"]["scripts"] == 1 and s["refs"]["has_remote_refs"] is True and s["refs"]["url_schemes"] == {"https": 1}


def test_budget_drops_are_recorded_never_silent():
    r = slice_state(fixture("adversarial.x3d"), facets=["header", "census", "geometry", "appearance", "lighting", "behavior", "view", "refs"], budget_bytes=300)
    assert r["meta"]["dropped_for_budget"], "a tight budget must drop something and say so"
    assert r["meta"]["bytes"] <= 400 and r["meta"]["budget_bytes"] == 300


def test_compression_ratio_and_hash():
    r = slice_state(fixture("adversarial.x3d"), facets=["census", "lighting"])
    assert r["meta"]["raw_bytes"] > r["meta"]["bytes"] and r["meta"]["ratio"] > 1
    assert len(r["meta"]["scene_sha256"]) == 64
    assert approx_tokens(r["meta"]["bytes"]) <= r["meta"]["bytes"]


def test_unknown_facet_and_non_x3d_refused():
    with pytest.raises(KeyError):
        slice_state(fixture("benign.x3d"), facets=["nope"])
    with pytest.raises(SceneRefused) as e:
        load("<html/>")
    assert e.value.code == "S1_NOT_X3D"


def test_entities_and_oversize_are_refused_before_parsing():
    bomb = '<?xml version="1.0"?><!DOCTYPE X3D [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;">]><X3D><Scene>&b;</Scene></X3D>'
    with pytest.raises(SceneRefused) as e:
        load(bomb)
    assert e.value.code == "S1_ENTITY"
    with pytest.raises(SceneRefused) as e:
        load("<X3D>" + " " * 100 + "</X3D>", max_bytes=50)
    assert e.value.code == "S1_TOO_LARGE"
    # the ordinary X3D DOCTYPE line is allowed and never fetched
    ok = '<?xml version="1.0"?><!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 4.0//EN" "https://www.web3d.org/specifications/x3d-4.0.dtd"><X3D profile="Core" version="4.0"><Scene/></X3D>'
    assert load(ok).profile == "Core"


def test_identical_scene_gives_identical_state_hash():
    a = slice_state(fixture("benign.x3d"))["meta"]["scene_sha256"]
    b = slice_state(open(fixture("benign.x3d"), "rb").read())["meta"]["scene_sha256"]
    assert a == b
