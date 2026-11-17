#!/usr/bin/env python3
"""Validate Resonance Loom's native X3D with the actual pinned x3d_mcp subset.

This dedicated adapter admits at most 8 MiB of UTF-8 XML per file. It does not
alter or bypass upstream parser limits, and never treats an unexecuted check
as a passing result. Dependencies: lxml and jsonschema; no running MCP server.
"""
from __future__ import annotations

import argparse
from dataclasses import asdict
from datetime import datetime, timezone
from decimal import Decimal, localcontext
import hashlib
import importlib
import importlib.util
from importlib import metadata
import json
import math
from pathlib import Path
import platform
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / 'vendor' / 'x3d_mcp'
VENDOR_SRC = VENDOR / 'src'
REPOSITORY = 'https://github.com/hagopjay/x3d_mcp'
COMMIT = 'b5c9956917714747fe1d034c729612e99b0f09c9'
ORIGIN_SHA256 = 'e7587506b4b4e3455f358451e104ad8d8e31514e6f8e687bdb2b9be5b170c349'
MAX_XML_BYTES = 8 * 1024 * 1024
DECLARATION = re.compile(r'<!\s*(?:DOCTYPE|ENTITY)\b', re.IGNORECASE)
KNOWN_DOCTYPES = tuple(f'<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D {version}//EN" "https://www.web3d.org/specifications/x3d-{version}.dtd">' for version in ['4.0','4.1'])
VERSION = re.compile(r'<X3D\b[^>]{0,4096}\bversion\s*=\s*[\"\']([^\"\']*)[\"\']')


class InstrumentError(RuntimeError):
    pass


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def canonical(value) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False,
                      allow_nan=False).encode('utf-8')


def instrument_identity() -> dict:
    """Verify the pinned manifest and every retained upstream file before use."""
    try:
        raw = (VENDOR / 'ORIGIN.json').read_bytes()
        if sha(raw) != ORIGIN_SHA256:
            raise InstrumentError('MCP_ORIGIN_DRIFT: pinned manifest hash changed')
        origin = json.loads(raw)
        if origin.get('repository') != REPOSITORY or origin.get('commit') != COMMIT:
            raise InstrumentError('MCP_ORIGIN_MISMATCH: repository/commit mismatch')
        inventory = origin.get('files_sha256')
        if not isinstance(inventory, dict) or not inventory:
            raise InstrumentError('MCP_ORIGIN_INVALID: no source inventory')
        actual = {}
        for name, digest in inventory.items():
            relative = Path(name)
            if relative.is_absolute() or '..' in relative.parts or not isinstance(digest, str) or not re.fullmatch('[0-9a-f]{64}', digest):
                raise InstrumentError('MCP_ORIGIN_INVALID: unsafe path or hash')
            actual[name] = sha((VENDOR / relative).read_bytes())
            if actual[name] != digest:
                raise InstrumentError('MCP_FILE_DRIFT: ' + name)
    except (OSError, ValueError) as error:
        raise InstrumentError('MCP_VENDOR_UNAVAILABLE: ' + str(error)) from error
    from lxml import etree
    result = {
        'repository': REPOSITORY, 'commit': COMMIT,
        'origin_sha256': ORIGIN_SHA256, 'files_sha256': actual,
        'adapter_sha256': sha(Path(__file__).read_bytes()),
        'invocation': ['validation.validate.validate_xml(version=document_declared_version)',
                       'validation.semantic.semantic_diagnostics'],
        'xsd_versions': ['4.0','4.1'], 'semantic_vocabulary_version': '4.1',
        'runtime': {'python': platform.python_version(),
                    'lxml': '.'.join(map(str, etree.LXML_VERSION)),
                    'libxml2': '.'.join(map(str, etree.LIBXML_VERSION)),
                    'jsonschema': metadata.version('jsonschema')},
    }
    result['identity_sha256'] = sha(canonical(result))
    return result


def check_module_origins(instrument: dict) -> None:
    for name, module in tuple(sys.modules.items()):
        if name in ('validation', 'x3d_utils') or name.startswith(('validation.', 'x3d_utils.')):
            origin = getattr(module, '__file__', None)
            if not origin:
                raise InstrumentError('MCP_MODULE_ORIGIN: ' + name)
            path = Path(origin).resolve()
            if not path.is_relative_to(VENDOR_SRC.resolve()):
                raise InstrumentError('MCP_NAMESPACE_CONFLICT: ' + name)
            relative = path.relative_to(VENDOR.resolve()).as_posix()
            if instrument['files_sha256'].get(relative) != sha(path.read_bytes()):
                raise InstrumentError('MCP_IMPORTED_FILE_DRIFT: ' + name)


def load_validator(instrument: dict):
    # Reject an existing conflicting namespace rather than silently reusing it.
    check_module_origins(instrument)
    if str(VENDOR_SRC) not in sys.path:
        sys.path.insert(0, str(VENDOR_SRC))
    validator = importlib.import_module('validation.validate')
    semantic = importlib.import_module('validation.semantic')
    check_module_origins(instrument)
    return validator, semantic


def validate_bytes(raw: bytes, expected_instrument: dict | None = None) -> dict:
    row = {'bytes': len(raw), 'candidate_sha256': sha(raw), 'status': 'not_run',
           'xsd': {'status': 'not_run', 'findings': []},
           'semantic': {'status': 'not_run', 'findings': []}}
    if len(raw) > MAX_XML_BYTES:
        row['input_refusal'] = 'The dedicated 8 MiB per-file XML budget was exceeded.'
        return row
    try:
        xml = raw.decode('utf-8')
    except UnicodeDecodeError:
        row.update(status='fail', input_refusal='Input is not UTF-8.')
        return row
    without_known_doctype = xml
    for known in KNOWN_DOCTYPES:
        without_known_doctype = without_known_doctype.replace(known, '', 1)
    if not xml.strip() or DECLARATION.search(without_known_doctype):
        row.update(status='fail', input_refusal='Only exact fixed Web3D 4.0/4.1 DOCTYPE declarations are admitted; arbitrary DTDs/entities and empty input are refused.')
        return row
    declared = VERSION.search(xml[:8192])
    declared = declared.group(1) if declared else None
    if declared not in ('4.0','4.1'):
        row.update(status='fail', input_refusal='Expected an explicit X3D 4.0 or 4.1 version.')
        return row
    row['document_declared_version'] = declared
    try:
        instrument = instrument_identity()
        if expected_instrument is not None and instrument != expected_instrument:
            raise InstrumentError('MCP_INSTRUMENT_DRIFT: changed during run')
        validator, semantic = load_validator(instrument)
        row['instrument_sha256'] = instrument['identity_sha256']
    except (ImportError, metadata.PackageNotFoundError) as error:
        row['dependency_error'] = type(error).__name__ + ': ' + str(error)
        return row
    except InstrumentError as error:
        row.update(status='error', instrument_error=str(error))
        return row
    try:
        result = validator.validate_xml(xml, version=declared)
        checked = result.get('checked') is not False
        status = 'not_run' if not checked else 'pass' if result.get('valid') is True else 'fail'
        row['xsd'] = {'status': status, 'schema_version': result.get('schema_version', declared),
                      'findings': result.get('errors', []), 'notes': result.get('notes', [])}
        if 'verdict' in result:
            row['xsd']['verdict'] = result['verdict']
    except Exception as error:
        row['xsd'] = {'status': 'error', 'findings': [type(error).__name__ + ': ' + str(error)]}
    try:
        findings = [asdict(finding) for finding in semantic.semantic_diagnostics(xml)]
        row['semantic'] = {'status': 'fail' if any(f.get('level') == 'error' for f in findings) else 'pass',
                           'findings': findings}
    except Exception as error:
        row['semantic'] = {'status': 'error', 'findings': [type(error).__name__ + ': ' + str(error)]}
    try:
        check_module_origins(instrument)
        if instrument_identity() != instrument:
            raise InstrumentError('MCP_INSTRUMENT_DRIFT: source changed during check')
    except InstrumentError as error:
        row.update(status='error', instrument_error=str(error))
        return row
    statuses = [row['xsd']['status'], row['semantic']['status']]
    row['status'] = ('error' if 'error' in statuses else 'fail' if 'fail' in statuses
                     else 'pass' if all(s == 'pass' for s in statuses) else 'not_run')
    return row


def negative_controls(instrument: dict | None) -> list[dict]:
    healthy = b'''<X3D profile="Interchange" version="4.0"><Scene><Shape><IndexedLineSet coordIndex="0 1 -1"><Coordinate DEF="Points" point="0 0 0 1 0 0"/></IndexedLineSet></Shape><Shape><PointSet><Coordinate USE="Points"/></PointSet></Shape></Scene></X3D>'''
    controls = []
    for version in ['4.0','4.1']:
        positive = healthy.replace(b'version="4.0"', ('version="'+version+'"').encode())
        good = validate_bytes(positive, instrument)
        for name, bad, stage in [
            ('invalid_numeric_coordinate', positive.replace(b'point="0 0 0 1 0 0"', b'point="0 0 broken 1 0 0"'), 'xsd'),
            ('unresolved_coordinate_USE', positive.replace(b'USE="Points"', b'USE="MissingPoints"'), 'semantic'),
        ]:
            defective = validate_bytes(bad, instrument)
            controls.append({'id': name+'_'+version, 'document_version':version, 'expected_stage': stage,
                             'positive': good, 'negative': defective,
                             'caught': good['status'] == 'pass' and defective[stage]['status'] == 'fail'})
    return controls


def canonical_geometry_audit(raw: bytes) -> dict:
    """Reconstruct the nine finite polylines from actual serialized X3D.

    This is separate from schema/semantic validation. It checks the canonical
    coordinate payload rather than decorative ribbons or projected screen pixels.
    """
    from lxml import etree
    reference_path = ROOT / 'data' / 'yantra.json'
    checker_path = ROOT / 'tools' / 'audit_independent.py'
    if not reference_path.is_file() or not checker_path.is_file():
        return {'status': 'not_run', 'reason': 'Canonical reference or independent checker is missing.'}
    try:
        reference_bytes = reference_path.read_bytes()
        reference = json.loads(reference_bytes)
        specification = importlib.util.spec_from_file_location('_native_yantra_independent_audit', checker_path)
        checker = importlib.util.module_from_spec(specification)
        specification.loader.exec_module(checker)
        root = etree.fromstring(raw, etree.XMLParser(resolve_entities=False, no_network=True))
        coordinates = root.xpath(".//Coordinate[@DEF='YantraCoordinates']")
        if len(coordinates) != 1:
            raise ValueError('Expected exactly one canonical Coordinate DEF=YantraCoordinates.')
        coordinate = coordinates[0]
        values = [float(token) for token in re.split(r'[\s,]+', coordinate.get('point', '').strip())]
        if not values or len(values) % 3 or not all(math.isfinite(v) for v in values):
            raise ValueError('Invalid canonical MFVec3f coordinates.')
        positions = [values[i:i+3] for i in range(0, len(values), 3)]
        line_set = coordinate.getparent()
        if line_set.tag != 'IndexedLineSet':
            raise ValueError('Canonical coordinate must belong to an IndexedLineSet.')
        indices = [int(token) for token in re.split(r'[\s,]+', line_set.get('coordIndex', '').strip())]
        polylines = []
        current = []
        for index in indices:
            if index == -1:
                if current: polylines.append(current)
                current = []
            else:
                if index < 0 or index >= len(positions):
                    raise ValueError('Canonical coordinate index out of range.')
                current.append(positions[index])
        if current: polylines.append(current)
        if len(polylines) != 9 or len(reference['triangles']) != 9:
            raise ValueError('Expected exactly nine canonical triangle polylines.')
        tolerance = 1e-7
        actual = {'triangles': []}
        maximum_coordinate_deviation = 0.
        maximum_closure_gap = 0.
        for line, ref in zip(polylines, reference['triangles']):
            if len(line) != 4:
                raise ValueError('Expected a closed four-point polyline per primary triangle.')
            maximum_closure_gap = max(maximum_closure_gap, math.dist(line[0], line[-1]))
            if max(abs(p[2]) for p in line) > tolerance:
                raise ValueError('Canonical triangle coordinates left their object-space plane.')
            points = [p[:2] for p in line[:3]]
            for point, original in zip(points, ref['vertices']):
                maximum_coordinate_deviation = max(maximum_coordinate_deviation, math.dist(point, original))
            actual['triangles'].append({'id': ref['id'], 'vertices': points})
        expected_arrangement = checker.audit(reference, 1e-10)
        measured_arrangement = checker.audit(actual, tolerance)
        measurement_path = ROOT / 'tools' / 'generate_yantra.py'
        measurement_spec = importlib.util.spec_from_file_location('_native_yantra_constraint_measurement', measurement_path)
        measurement = importlib.util.module_from_spec(measurement_spec)
        measurement_spec.loader.exec_module(measurement)
        with localcontext() as context:
            context.prec = 100
            decimal_triangles = [[[Decimal.from_float(v) for v in p] for p in triangle['vertices']] for triangle in actual['triangles']]
            constraint_measurements = measurement.measure(decimal_triangles)
        segments = {t['id']+':'+str(i): (t['vertices'][i], t['vertices'][(i+1)%3])
                    for t in actual['triangles'] for i in range(3)}
        worst_incidence = 0.
        for node in expected_arrangement['multiLineIntersections']:
            lines = []
            for name in node['segments']:
                a, b = segments[name]
                dx, dy = b[0]-a[0], b[1]-a[1]
                length = math.hypot(dx, dy)
                nx, ny = -dy/length, dx/length
                lines.append((nx, ny, nx*a[0]+ny*a[1]))
            aa = sum(a*a for a,b,c in lines); bb = sum(b*b for a,b,c in lines)
            ab = sum(a*b for a,b,c in lines); ac = sum(a*c for a,b,c in lines)
            bc = sum(b*c for a,b,c in lines); determinant = aa*bb-ab*ab
            x = (ac*bb-bc*ab)/determinant; y = (bc*aa-ac*ab)/determinant
            worst_incidence = max(worst_incidence, max(abs(a*x+b*y-c) for a,b,c in lines))
        reflections = [math.hypot(t['vertices'][1][0]+t['vertices'][2][0],
                                  t['vertices'][1][1]-t['vertices'][2][1]) for t in actual['triangles']]
        circles = [abs(math.hypot(*p)-1) for t in actual['triangles'] if t['id'] in ('T3','T7') for p in t['vertices']]
        uniform_scales = []
        for name in ['YantraFront', 'YantraBack']:
            matches = root.xpath(".//Transform[@DEF=$name]", name=name)
            if len(matches) != 1: raise ValueError('Expected named transform '+name)
            scale = [float(v) for v in re.split(r'[\s,]+', matches[0].get('scale','1 1 1').strip())]
            uniform_scales.append({'node':name, 'scale':scale,
                                   'uniform':len(scale)==3 and min(scale)>0 and max(scale)-min(scale)<=tolerance})
        checks = {
            'coordinate_deviation_within_tolerance': maximum_coordinate_deviation <= tolerance,
            'closed_triangle_polylines': maximum_closure_gap <= tolerance,
            'canonical_incidence_within_tolerance': worst_incidence <= tolerance,
            'reflection_within_tolerance': max(reflections) <= tolerance,
            'common_circumcircle_within_tolerance': max(circles) <= tolerance,
            'exactly_43_odd_coverage_triangular_chambers': measured_arrangement['oddTriangularChambers']==43,
            'all_odd_coverage_faces_triangular': measured_arrangement['oddCoverageFaces']==43 and measured_arrangement['oddCoverageCornerHistogram']=={3:43},
            'correct_chamber_ring_counts': measured_arrangement['chamberCountsOutsideIn']==[14,10,10,8,1],
            'euler_consistent': measured_arrangement['eulerConsistent'],
            'front_and_back_uniform_scales': all(item['uniform'] for item in uniform_scales),
            'underlay_reuses_canonical_coordinates': bool(root.xpath(".//Coordinate[@USE='YantraCoordinates']")),
            'direct_decimal_constraint_measurements_within_tolerance': all(Decimal(value)<=Decimal(str(tolerance)) for value in constraint_measurements['maxima'].values()),
        }
        return {'status':'pass' if all(checks.values()) else 'fail', 'tolerance_radius_units':tolerance,
                'topological_snap_tolerance_radius_units':tolerance, 'radius':1,
                'reference_path':'data/yantra.json', 'reference_sha256':sha(reference_bytes),
                'independent_checker_path':'tools/audit_independent.py',
                'independent_checker_sha256':sha(checker_path.read_bytes()),
                'direct_constraint_measurement_path':'tools/generate_yantra.py',
                'direct_constraint_measurement_sha256':sha(measurement_path.read_bytes()),
                'direct_decimal_constraint_maxima_radius_units':constraint_measurements['maxima'],
                'direct_decimal_constraint_method':'Decimal.from_float of these serialized coordinates; 100-digit arithmetic; 24 prescribed point-on-base triple residuals, seven apex/base incidences, six common-circle vertices, reflection, central incenter.',
                'primary_triangles':len(actual['triangles']), 'object_space_coordinate_count':len(positions),
                'max_coordinate_deviation_radius_units':maximum_coordinate_deviation,
                'max_prescribed_incidence_line_distance_radius_units':worst_incidence,
                'max_reflection_error_radius_units':max(reflections),
                'max_common_circumcircle_error_radius_units':max(circles),
                'max_polyline_closure_gap_radius_units':maximum_closure_gap,
                'odd_triangular_chambers':measured_arrangement['oddTriangularChambers'],
                'bounded_faces':measured_arrangement['boundedFaces'],
                'chamber_counts_outside_in':measured_arrangement['chamberCountsOutsideIn'],
                'off_axis_multiline_intersections':measured_arrangement['offAxisMultiLineIntersectionCount'],
                'uniform_scales':uniform_scales, 'checks':checks,
                'scope':'Object-space canonical polylines reconstructed from these exact XML bytes; not antialiasing, stroke-width or screen-projection accuracy.'}
    except Exception as error:
        return {'status':'error', 'error':type(error).__name__+': '+str(error)}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('files', nargs='*', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'docs' / 'native-validation.json')
    args = parser.parse_args(argv)
    paths = args.files or [ROOT / 'dist' / 'Sri-Yantra-Resonance-Loom.x3d']
    instrument = None
    instrument_problem = None
    try:
        instrument = instrument_identity()
    except (InstrumentError, ImportError, metadata.PackageNotFoundError) as error:
        instrument_problem = type(error).__name__ + ': ' + str(error)
    rows = []
    for candidate in paths:
        path = candidate.resolve()
        name = path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else path.name
        try:
            size = path.stat().st_size
            if size > MAX_XML_BYTES:
                row = {'bytes': size, 'candidate_sha256': None, 'status': 'not_run',
                       'xsd': {'status': 'not_run'}, 'semantic': {'status': 'not_run'},
                       'input_refusal': '8 MiB per-file budget exceeded; bytes were not read or hashed.'}
            else:
                raw = path.read_bytes()
                row = validate_bytes(raw, instrument)
                if row['xsd']['status'] == 'pass':
                    row['canonical_geometry'] = canonical_geometry_audit(raw)
                    if row['status'] == 'pass' and row['canonical_geometry']['status'] != 'pass':
                        row['status'] = row['canonical_geometry']['status']
        except OSError as error:
            row = {'status': 'error', 'input_error': type(error).__name__ + ': ' + str(error)}
        rows.append({'path': name, **row})
    controls = negative_controls(instrument)
    passed = bool(rows) and instrument is not None and all(r['status'] == 'pass' for r in rows) and all(c['caught'] for c in controls)
    report = {'schema': 'yantra-loom.native-x3d-validation/1',
              'created_utc': datetime.now(timezone.utc).isoformat(),
              'status': 'pass' if passed else 'incomplete_or_failed',
              'input_cap_bytes': MAX_XML_BYTES, 'instrument': instrument,
              'instrument_problem': instrument_problem, 'files': rows, 'controls': controls,
              'limitations': [
                  'Actual direct calls to pinned x3d_mcp functions, not an MCP transport/server invocation.',
                  'Each document is checked against its declared bundled XSD 4.0 or 4.1; upstream semantic vocabulary 4.1 is recorded separately.',
                  'X_ITE native serialization declares X3D 4.1 even though the authored source declares 4.0; no relabeling or schema substitution is performed.',
                  'Only exact fixed Web3D DOCTYPE declarations are admitted; arbitrary DTD/entity declarations are refused before upstream parsing.',
                  'No upstream parser limit or source is modified; this adapter applies its own 8 MiB file cap.',
                  'Schema and implemented semantic checks do not prove Sri Yantra mathematics, complete scene semantics, rendering fidelity, audio synchronization or GPU performance.',
                  'Canonical geometry and animation/presentation require their separate numerical and browser controls.',
                  'This unsigned local report is not a formal Loom acceptance receipt or publisher signature.',
              ]}
    report['report_sha256'] = sha(canonical(report))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + '\n', encoding='utf-8')
    print(json.dumps({'status': report['status'], 'files': len(rows),
                      'passed': sum(r['status'] == 'pass' for r in rows),
                      'negative_controls_caught': sum(c['caught'] for c in controls),
                      'output': str(args.output)}, indent=2))
    return 0 if passed else 1


if __name__ == '__main__':
    raise SystemExit(main())
