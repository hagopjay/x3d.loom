"""Deterministic, local X3D decision rehearsals. No model, key or hosted transport.

This produces x3d.s1.rehearsal/1, never a Loom witness or acceptance receipt.
Local XML observations and authored routing inputs cannot certify a release.
"""
from __future__ import annotations

import argparse
from dataclasses import asdict
import hashlib
import json
import math
from pathlib import Path
import platform
import sys
from typing import Mapping

ROOT = Path(__file__).resolve().parent
S1_ROOT = ROOT.parent                    # the observatory lives inside x3d.s1 and inspects that package's exact source
sys.path.insert(0, str(S1_ROOT))
from x3d_s1.decidable import CATALOGUE, D
from x3d_s1.pipeline import triage
from x3d_s1.questions import Choice, parse_answer
from x3d_s1.routing import ActionPolicy, Policy, route_choice
from x3d_s1.state import GEOMETRY, load, slice_state
from x3d_s1.untrusted import lint_text

SCHEMA = 'x3d.s1.rehearsal/1'
HASH_PROFILE = 'x3d.s1.rehearsal-c14n/1'
QUESTION = Choice('Which investigation path should be considered first? This is an authored routing exercise, not a judgment of scene validity.', {
    'continue': 'Consider the visual inspection path first; all required witnesses remain required.',
    'inspect': 'Consider the structural inspection path first; all required witnesses remain required.',
})
REQUIREMENTS = {
    'xsd': ('X3D schema', 'A complete pinned XSD validator must inspect these candidate bytes.'),
    'semantic': ('X3D semantics', 'Run the complete pinned semantic gate; this local reference inventory is narrower.'),
    'render_nonblank': ('Rendered visibility', 'A renderer instrument must capture a pinned camera/viewport and apply declared nonblank tests.'),
    'render_reference': ('Reference comparison', 'A reference image, camera and predeclared comparison bounds are needed.'),
    'release_provenance': ('Release provenance', 'The actual Loom kit must verify candidate, instrument and evidence identities under its named profile.'),
}
PROFILES = {
    'preview': {'label': 'Preview rehearsal', 'required': ('xsd', 'semantic', 'render_nonblank')},
    'release': {'label': 'Release rehearsal', 'required': ('xsd', 'semantic', 'render_nonblank', 'render_reference', 'release_provenance')},
}


def canonical(value) -> bytes:
    # Our bounded JSON profile treats 1 and 1.0 alike, as a browser does. This is
    # not RFC 8785/JCS. Reparse then canonicalize with this implementation.
    # A JSON.stringify export must not invalidate a record just by dropping .0.
    def normalized(item):
        if isinstance(item, float):
            if not math.isfinite(item):
                raise ValueError('Canonical JSON refuses nonfinite numbers')
            return int(item) if item.is_integer() else item
        if isinstance(item, dict):
            return {key: normalized(val) for key, val in item.items()}
        if isinstance(item, (list, tuple)):
            return [normalized(val) for val in item]
        return item
    return json.dumps(normalized(value), sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode('utf-8')


def digest(value) -> str:
    return hashlib.sha256(value if isinstance(value, bytes) else canonical(value)).hexdigest()


def number(value, name: str) -> float:
    try:
        ok = not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value) and 0 <= value <= 1
    except OverflowError:  # an integer too large for a float is out of range, not a crash
        ok = False
    if not ok:
        raise ValueError(f'{name} must be a finite number in [0, 1]')
    return float(value)


def strict_json(text: str):
    def refuse(value):
        raise ValueError(f'Nonfinite JSON constant {value!r} is not allowed')
    def unique(pairs):
        out = {}
        for key, value in pairs:
            if key in out:
                raise ValueError(f'Duplicate JSON key {key!r}')
            out[key] = value
        return out
    try:
        return json.loads(text, parse_constant=refuse, object_pairs_hook=unique)
    except RecursionError:  # deeply nested arrays are a refusal, not a dropped connection
        raise ValueError('JSON is nested too deeply') from None


def scene_records() -> list[dict]:
    value = strict_json((ROOT / 'manifest.json').read_text(encoding='utf-8'))
    if not isinstance(value, list) or not value:
        raise ValueError('The authored fixture manifest must be a nonempty array')
    seen = set()
    for item in value:
        key = item.get('id')
        if not isinstance(key, str) or not key or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in key) or key in seen:
            raise ValueError('Fixture IDs must be unique local identifiers')
        if item.get('uri') != '/scenes/' + key + '.x3d' or not (ROOT / 'scenes' / (key + '.x3d')).is_file():
            raise ValueError('Fixture URIs must resolve to the local authored fixture set')
        if item.get('synthetic') is not True:
            raise ValueError('Teaching fixtures must be labelled synthetic')
        seen.add(key)
    return value


def catalog() -> dict:
    return {'schema': 'x3d.s1.rehearsal-catalog/1', 'offline': True, 'model_calls': 0,
            'profiles': [{'id': key, 'label': value['label'], 'requirements': [{'id': r, 'label': REQUIREMENTS[r][0]} for r in value['required']]} for key, value in PROFILES.items()],
            'scenes': scene_records()}


def requirement_ids(profile_id: str) -> tuple[str, ...]:
    # Deliberately has no advisory argument. The synthetic answer cannot add,
    # remove or satisfy a profile requirement.
    if profile_id not in PROFILES:
        raise ValueError('Unknown rehearsal profile')
    return PROFILES[profile_id]['required']


def schedule(profile_id: str, p: float) -> list[dict]:
    p = number(p, 'synthetic continue probability')
    # Authored, unitless teaching weights, not latency measurements or a learned
    # fault predictor. They illustrate ordering while preserving membership.
    weights = {'xsd': (1.05-p, 1.0), 'semantic': (0.9-0.8*p, 1.5),
               'render_nonblank': (0.1+0.9*p, 1.0), 'render_reference': (0.1+0.8*p, 2.0),
               'release_provenance': (0.2, 3.0)}
    rows = []
    for key in requirement_ids(profile_id):
        risk, cost = weights[key]
        rows.append({'id': key, 'label': REQUIREMENTS[key][0], 'status': 'not_run',
                     'reason': REQUIREMENTS[key][1], 'priority': round(risk / cost, 6),
                     'estimated_cost_units': cost, 'priority_scope': 'Authored unitless teaching weights; not measured time or risk.'})
    return sorted(rows, key=lambda row: (-row['priority'], row['id']))


def _source_hashes() -> dict:
    paths = [ROOT / 'rehearsal.py', ROOT / 'server.py'] + sorted((S1_ROOT / 'x3d_s1').glob('*.py'))
    hashes = {}
    for path in paths:
        relative = path.relative_to(ROOT.parent).as_posix()
        hashes[relative] = digest(path.read_bytes())
    return hashes


def instrument_identity() -> dict:
    hashes = _source_hashes()
    if hashes != _LOADED_SOURCE_HASHES:
        raise ValueError('Instrument source changed after this process started. Restart the local server before collecting another rehearsal.')
    return {'name': 'offline declaration inspector and rehearsal planner', 'code_sha256': digest(hashes),
            'files': hashes, 'runtime': 'Python ' + platform.python_version(),
            'scope': 'Code identity and self-consistency, not authenticated instrument authority.'}


def inspect_source(sc) -> tuple[list[dict], dict]:
    root = sc.root
    defs = {}
    issues = []
    counts = {'definitions': 0, 'uses': 0, 'routes': 0}
    # One document-order DEF scope is sufficient for our authored fixtures.
    # PROTO namespaces/expansion, imports/exports and field signatures require
    # the external semantic gate and are explicitly outside this observation.
    for ordinal, node in enumerate(root.iter()):
        name = node.get('DEF')
        use = node.get('USE')
        if name:
            counts['definitions'] += 1
            if name in defs:
                issues.append({'code': 'duplicate_def', 'ordinal': ordinal, 'name': name})
            else:
                defs[name] = node.tag
        if use:
            counts['uses'] += 1
            if use not in defs:
                issues.append({'code': 'missing_or_forward_use', 'ordinal': ordinal, 'name': use})
            elif defs[use] != node.tag:
                issues.append({'code': 'use_type_mismatch', 'ordinal': ordinal, 'name': use})
    for ordinal, node in enumerate(root.iter('ROUTE')):
        counts['routes'] += 1
        for field in ('fromNode', 'toNode'):
            if node.get(field) not in defs:
                issues.append({'code': 'missing_route_node', 'route': ordinal, 'field': field, 'name': node.get(field)})
    flagged = []
    for node in root.iter():
        for key, text in node.attrib.items():
            hits = lint_text(text)
            if hits:
                flagged.append({'node_type': node.tag, 'field': key, 'patterns': hits})
        if node.text and node.text.strip():
            hits = lint_text(node.text)
            if hits:
                flagged.append({'node_type': node.tag, 'field': '#text', 'patterns': hits})
    declaration = {'hidden_switches': sum(n.get('whichChoice') == '-1' for n in root.iter('Switch')),
                   'zero_scale_transforms': sum(n.get('scale', '').split() == ['0', '0', '0'] for n in root.iter('Transform')),
                   'geometry_declarations': sum(n.tag in GEOMETRY and not n.get('USE') for n in root.iter()),
                   'instruction_pattern_fields': len(flagged)}
    return [
        {'id': 'xml_parse', 'label': 'XML parse', 'status': 'pass', 'scope': 'Well-formed X3D XML root only; not XSD conformance.', 'detail': f'{sc.raw_bytes:,} bytes parsed locally.'},
        {'id': 'reference_inventory', 'label': 'Source references', 'status': 'fail' if issues else 'pass',
         'scope': 'Document-order DEF/USE names and ROUTE node names; no PROTO scopes or field-signature validation.',
         'detail': f"{len(issues)} finding(s); {counts['definitions']} DEF declarations, {counts['uses']} USE declarations, {counts['routes']} ROUTEs.", 'findings': issues},
        {'id': 'text_separation', 'label': 'Text boundary', 'status': 'pass', 'scope': 'Authored scene text is excluded from the synthetic question state; lint is a pattern screen, not an injection proof.',
         'detail': f'{len(flagged)} instruction-pattern field(s) observed; no free scene text sent to a model.', 'findings': flagged},
    ], declaration


def rehearse(scene_id: str, profile_id: str = 'preview', p: float = 0.85, threshold: float = 0.8) -> dict:
    p = number(p, 'synthetic continue probability')
    threshold = number(threshold, 'routing threshold')
    requirement_ids(profile_id)
    records = {item['id']: item for item in scene_records()}
    if scene_id not in records:
        raise ValueError('Choose a scene from the authored fixture catalogue')
    item = records[scene_id]
    raw = (ROOT / 'scenes' / (scene_id + '.x3d')).read_bytes()
    sc = load(raw, max_bytes=1_000_000)
    observations, declaration = inspect_source(sc)
    sl = slice_state(sc, ['header', 'census', 'geometry', 'appearance', 'lighting', 'behavior', 'refs', 'view'], budget_bytes=12_000)
    if sl['meta']['dropped_for_budget']:
        raise ValueError('The controlled fixture no longer fits the declared state budget')
    exact = triage(sc, qids=[q.id for q in CATALOGUE if q.cls == D])
    choice = 'continue' if p >= 0.5 else 'inspect'
    parsed = parse_answer(QUESTION, {'type': 'choice', 'choice': choice, 'probabilities': {'continue': p, 'inspect': 1-p}})
    policy = Policy(floor=0.5, actions={key: ActionPolicy('prioritize_' + key, stakes='low', min_p=threshold) for key in QUESTION.options})
    route = route_choice(parsed, policy)
    witnesses = schedule(profile_id, p)
    invariant = all(set(row['id'] for row in schedule(profile_id, n/10)) == set(requirement_ids(profile_id))
                    and all(row['status'] == 'not_run' for row in schedule(profile_id, n/10)) for n in range(11))
    instrument = instrument_identity()
    question = {'id': 'rehearsal.investigation_order', 'text': QUESTION.instructions, 'options': dict(QUESTION.criteria)}
    policy_record = {'profile_id': profile_id, 'floor': policy.floor, 'threshold': threshold,
                     'actions': {key: asdict(value) for key, value in policy.actions.items()}, 'required': list(requirement_ids(profile_id))}
    bindings = {'candidate_sha256': sc.sha256, 'question_sha256': digest(QUESTION.to_wire()),
                'state_sha256': digest(sl['state']), 'policy_sha256': digest(policy_record), 'instrument_sha256': instrument['code_sha256']}
    body = {'schema': SCHEMA, 'hash_profile': HASH_PROFILE, 'mode': 'synthetic', 'acceptance_eligible': False, 'model_calls': 0,
            'candidate': {'id': scene_id, 'title': item['title'], 'sha256': sc.sha256, 'bytes': len(raw), 'uri': item['uri'], 'synthetic': True},
            'profile': {'id': profile_id, 'label': PROFILES[profile_id]['label'], 'scope': 'Prospective rehearsal requirements; not a registered Loom release profile.'},
            'inputs': {'scene_id': scene_id, 'profile_id': profile_id, 'p': p, 'threshold': threshold},
            'summary': {'xml_parse': 'passed', 'exact_count': len(exact['answers']), 'required_count': len(witnesses),
                        'outstanding_count': len(witnesses), 'advisory_route': route.outcome},
            'observations': observations, 'declarations': declaration, 'exact_answers': exact['answers'],
            'required_witnesses': witnesses, 'advisory': {'source': 'synthetic', 'grade': 'S', 'question': question,
                'synthetic_continue_probability': p, 'answer': {'choice': parsed.choice, 'p': parsed.p,
                    'probabilities': dict(parsed.probabilities), 'confidence': parsed.confidence},
                'route': route.to_dict(), 'calibration': 'unmeasured',
                'scope': 'Authored counterfactual distribution. No Jev response, measured accuracy, gate verdict or release authorization.'},
            'state_slice': sl, 'noninterference': {'checked': invariant, 'cases': 11, 'requirements_unchanged': invariant,
                'acceptance_eligible_unchanged': True, 'scope': 'Counterfactual planner check; not a proof of the complete external Loom kit.'},
            'bindings': bindings, 'instrument': instrument, 'policy': policy_record,
            'timeline': [
                {'stage': '01', 'label': 'Bind candidate', 'status': 'observed', 'detail': 'Read fixture bytes once and bind all local observations to their full SHA-256.'},
                {'stage': '02', 'label': 'Answer declarations', 'status': 'observed', 'detail': 'Answer D questions locally; inspect a narrower source-reference inventory.'},
                {'stage': '03', 'label': 'Rehearse attention', 'status': 'synthetic', 'detail': 'Move authored probabilities to change advisory routing and witness order.'},
                {'stage': '04', 'label': 'Collect actual witnesses', 'status': 'not_run', 'detail': 'Every prospective external witness remains outstanding.'},
            ],
            'limitations': [
                'No model was called. The synthetic probabilities do not measure Jev or any other model.',
                'All prospective witness requirements remain not_run. This record cannot certify an artifact.',
                'Declarations are read from source XML; PROTO expansion, Inline resources, scripts and event execution are unresolved.',
                'The browser viewport is an illustrative preview, not a candidate-bound render witness or a blank-frame measurement.',
                'Authored scheduling weights are unitless teaching values, not measured latency or learned fault likelihood.',
                'Full hashes and successful replay establish self-consistency, not authenticity or independent instrument provenance.',
                'The attached corpus measurements and pull-request states are historical snapshots; this run does not refresh them.',
            ]}
    body['receipt_sha256'] = digest(body)
    return body


def verify_rehearsal(value: Mapping) -> dict:
    if not isinstance(value, dict) or value.get('schema') != SCHEMA or value.get('hash_profile') != HASH_PROFILE or value.get('acceptance_eligible') is not False or value.get('mode') != 'synthetic' or value.get('model_calls') != 0:
        raise ValueError('Not an offline, ineligible rehearsal record')
    content = dict(value)
    claimed = content.pop('receipt_sha256', None)
    if claimed != digest(content):
        raise ValueError('Rehearsal content digest mismatch')
    inputs = value.get('inputs')
    if not isinstance(inputs, dict) or set(inputs) != {'scene_id', 'profile_id', 'p', 'threshold'}:
        raise ValueError('Missing or unexpected replay inputs')
    replay = rehearse(**inputs)
    if canonical(value) != canonical(replay):
        raise ValueError('Replay mismatch: candidate, instrument, policy or recorded observations have changed')
    return {'schema': 'x3d.s1.rehearsal-verification/1', 'matches_current_replay': True,
            'receipt_sha256': claimed, 'acceptance_eligible': False,
            'scope': 'Exact local replay comparison; not an independent Loom witness.'}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('catalog')
    run = sub.add_parser('run'); run.add_argument('--scene', default='clean-rig'); run.add_argument('--profile', default='preview', choices=PROFILES)
    run.add_argument('--p', type=float, default=0.85); run.add_argument('--threshold', type=float, default=0.8); run.add_argument('--out', type=Path)
    verify = sub.add_parser('verify'); verify.add_argument('record', type=Path)
    examples = sub.add_parser('build-examples'); examples.add_argument('--out', type=Path, default=ROOT / 'reports')
    args = parser.parse_args(argv)
    if args.command == 'catalog':
        result = catalog()
    elif args.command == 'verify':
        result = verify_rehearsal(strict_json(args.record.read_text(encoding='utf-8')))
    elif args.command == 'build-examples':
        args.out.mkdir(parents=True, exist_ok=True)
        records = []
        for scene in scene_records():
            record = rehearse(scene['id'])
            path = args.out / (scene['id'] + '.json')
            path.write_text(json.dumps(record, indent=2, ensure_ascii=False, allow_nan=False) + '\n', encoding='utf-8')
            records.append({'scene': scene['id'], 'sha256': record['receipt_sha256'], 'path': path.name})
        result = {'schema': 'x3d.s1.rehearsal-examples/1', 'records': records, 'model_calls': 0, 'acceptance_eligible': False}
    else:
        result = rehearse(args.scene, args.profile, args.p, args.threshold)
    text = json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + '\n'
    if getattr(args, 'out', None) and args.command == 'run':
        args.out.write_text(text, encoding='utf-8')
    else:
        print(text, end='')
    return 0


_LOADED_SOURCE_HASHES = _source_hashes()


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (ValueError, KeyError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2)
