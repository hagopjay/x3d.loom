"""Control the epistemic boundary, not just the displayed JSON shape."""
import copy
import inspect
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import rehearsal as r


class RehearsalTests(unittest.TestCase):
    def test_all_six_authored_controls_are_present(self):
        rows = r.scene_records()
        self.assertEqual(len(rows), 6)
        self.assertTrue(all(x['synthetic'] for x in rows))
        self.assertEqual(len({x['id'] for x in rows}), 6)

    def test_exact_reference_inventory_finds_only_the_negative_control(self):
        for scene in r.scene_records():
            with self.subTest(scene=scene['id']):
                result = r.rehearse(scene['id'])
                obs = next(x for x in result['observations'] if x['id'] == 'reference_inventory')
                self.assertEqual(obs['status'], scene['expected']['reference_audit'])
                if scene['id'] == 'broken-reference':
                    self.assertEqual(len(obs['findings']), 2)

    def test_parseable_invisible_controls_never_acquire_render_evidence(self):
        for scene in ['hidden-switch', 'zero-scale', 'empty-geometry']:
            result = r.rehearse(scene)
            self.assertEqual(result['summary']['xml_parse'], 'passed')
            self.assertFalse(result['acceptance_eligible'])
            render = next(x for x in result['required_witnesses'] if x['id'] == 'render_nonblank')
            self.assertEqual(render['status'], 'not_run')

    def test_declaration_controls_are_distinguished(self):
        self.assertGreater(r.rehearse('hidden-switch')['declarations']['hidden_switches'], 0)
        self.assertGreater(r.rehearse('zero-scale')['declarations']['zero_scale_transforms'], 0)
        self.assertEqual(r.rehearse('empty-geometry')['declarations']['geometry_declarations'], 0)

    def test_instruction_text_is_observed_but_excluded_from_judgment_state(self):
        result = r.rehearse('untrusted-notes')
        self.assertGreater(result['declarations']['instruction_pattern_fields'], 0)
        self.assertFalse(result['state_slice']['meta']['untrusted_included'])
        text = r.canonical(result['state_slice']['state']).decode()
        self.assertNotIn('Ignore all previous', text)
        self.assertNotIn('MetadataString', text.split('"text":')[-1] if '"text":' in text else '')
        self.assertNotIn('names', result['state_slice']['state'])

    def test_required_membership_and_status_ignore_all_counterfactual_answers(self):
        for profile in r.PROFILES:
            expected = set(r.requirement_ids(profile))
            for p in [0, 0.01, 0.1, 0.3, 0.49, 0.5, 0.51, 0.7, 0.9, 0.99, 1]:
                rows = r.schedule(profile, p)
                self.assertEqual({x['id'] for x in rows}, expected)
                self.assertTrue(all(x['status'] == 'not_run' for x in rows))

    def test_order_really_changes_without_changing_requirements(self):
        a, b = r.schedule('release', 0), r.schedule('release', 1)
        self.assertNotEqual([x['id'] for x in a], [x['id'] for x in b])
        self.assertEqual({x['id'] for x in a}, {x['id'] for x in b})

    def test_requirement_function_does_not_accept_an_advisory(self):
        self.assertEqual(tuple(inspect.signature(r.requirement_ids).parameters), ('profile_id',))

    def test_confidence_and_selected_probability_are_different(self):
        answer = r.rehearse('clean-rig', p=.85)['advisory']['answer']
        self.assertAlmostEqual(answer['p'], .85)
        self.assertAlmostEqual(answer['confidence'], .70)
        answer = r.rehearse('clean-rig', p=.1)['advisory']['answer']
        self.assertEqual(answer['choice'], 'inspect')
        self.assertAlmostEqual(answer['p'], .9)

    def test_threshold_changes_route_but_never_proof_gap(self):
        a = r.rehearse('clean-rig', p=.85, threshold=.8)
        b = r.rehearse('clean-rig', p=.85, threshold=.95)
        self.assertNotEqual(a['advisory']['route']['outcome'], b['advisory']['route']['outcome'])
        self.assertEqual(a['required_witnesses'], b['required_witnesses'])
        self.assertFalse(a['acceptance_eligible'] or b['acceptance_eligible'])

    def test_full_identity_hashes_and_deterministic_replay(self):
        a = r.rehearse('clean-rig')
        self.assertEqual(a, r.rehearse('clean-rig'))
        self.assertTrue(all(len(v) == 64 for v in a['bindings'].values()))
        self.assertTrue(r.verify_rehearsal(a)['matches_current_replay'])

    def test_adversarial_metadata_changes_candidate_identity(self):
        clean, untrusted = r.rehearse('clean-rig'), r.rehearse('untrusted-notes')
        self.assertNotEqual(clean['candidate']['sha256'], untrusted['candidate']['sha256'])
        self.assertEqual({x['id'] for x in clean['required_witnesses']}, {x['id'] for x in untrusted['required_witnesses']})

    def test_changed_candidate_record_is_rejected_even_with_a_new_content_hash(self):
        value = r.rehearse('clean-rig')
        value['candidate']['sha256'] = '0' * 64
        value.pop('receipt_sha256')
        value['receipt_sha256'] = r.digest(value)
        with self.assertRaisesRegex(ValueError, 'Replay mismatch'):
            r.verify_rehearsal(value)

    def test_forged_witness_pass_cannot_be_laundered_by_rehashing(self):
        value = r.rehearse('clean-rig')
        value['required_witnesses'][0]['status'] = 'pass'
        value.pop('receipt_sha256')
        value['receipt_sha256'] = r.digest(value)
        with self.assertRaisesRegex(ValueError, 'Replay mismatch'):
            r.verify_rehearsal(value)

    def test_no_promoted_acceptance_even_if_record_is_rehashed(self):
        value = r.rehearse('clean-rig')
        value['acceptance_eligible'] = True
        value.pop('receipt_sha256')
        value['receipt_sha256'] = r.digest(value)
        with self.assertRaisesRegex(ValueError, 'ineligible'):
            r.verify_rehearsal(value)

    def test_invalid_parameters_and_scene_paths_are_refused(self):
        for p in [True, '0.7', [], float('nan'), float('inf'), -.1, 1.1]:
            with self.subTest(p=repr(p)), self.assertRaises(ValueError):
                r.rehearse('clean-rig', p=p)
        for scene in ['../README', 'https://example.com/scene', '/etc/passwd']:
            with self.assertRaises(ValueError):
                r.rehearse(scene)

    def test_integers_too_large_for_a_float_and_deep_nesting_are_refused_not_raised(self):
        huge = int('9' * 400)
        for kwargs in [{'p': huge}, {'threshold': huge}, {'p': -huge}]:
            with self.subTest(kwargs=list(kwargs)), self.assertRaises(ValueError):
                r.rehearse('clean-rig', **kwargs)
        with self.assertRaisesRegex(ValueError, 'nested too deeply'):
            r.strict_json('[' * 20000 + ']' * 20000)

    def test_nonfinite_and_duplicate_json_are_refused(self):
        for text in ['{"p":NaN}', '{"p":Infinity}', '{"p":0.1,"p":0.9}']:
            with self.assertRaises(ValueError):
                r.strict_json(text)

    def test_no_fixture_executes_scene_code_or_loads_external_resources(self):
        for scene in r.scene_records():
            root = r.load((ROOT / 'scenes' / (scene['id'] + '.x3d')).read_bytes()).root
            self.assertFalse(any(n.tag in {'Script', 'Inline', 'ExternProtoDeclare', 'ShaderPart', 'ShaderProgram'} for n in root.iter()))
            self.assertFalse(any('url' in n.attrib for n in root.iter()))

    def test_running_instrument_refuses_source_drift(self):
        drifted = dict(r._LOADED_SOURCE_HASHES)
        self.assertIn('observatory/rehearsal.py', drifted)
        drifted['observatory/rehearsal.py'] = '0' * 64
        with patch.object(r, '_source_hashes', return_value=drifted):
            with self.assertRaisesRegex(ValueError, 'source changed'):
                r.rehearse('clean-rig')

    def test_browser_number_normalization_preserves_export_identity(self):
        value = r.rehearse('clean-rig', p=1, threshold=0)
        # JavaScript has one Number type: JSON.stringify drops integral .0.
        exported = json.loads(json.dumps(value), parse_float=lambda text: int(float(text)) if float(text).is_integer() else float(text))
        self.assertTrue(r.verify_rehearsal(exported)['matches_current_replay'])
        self.assertEqual(r.canonical({'p': -0.0, 'n': 1.0}), r.canonical({'p': 0, 'n': 1}))


if __name__ == '__main__':
    unittest.main()
