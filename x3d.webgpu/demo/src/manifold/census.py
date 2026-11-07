#!/usr/bin/env python3 -I
"""Census of the Manifold of Emotion X3D scene for the WebGPU port: node counts, ComposedShader hash keys, uniforms and shader sizes.

  python3 -I census.py --site PATH_TO_SITE_FOLDER      # the folder that holds scenes/manifold.x3d (the x3d.STEM Pages build or studies/manifold)

Keys use the same rule as build-brain.py: FNV-1a of the whitespace-collapsed GLSL, vertex-hash + '-' + fragment-hash.
Prints a table; --json writes it. Nothing is fetched and nothing is written next to the scene."""
import argparse, collections, json, os, re, base64, urllib.parse

def fnv(s):
    h = 0x811c9dc5
    for ch in s: h ^= ord(ch); h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h

def part_source(body):
    u = body.strip()
    c = u.index(',')
    head, data = u[:c], u[c + 1:]
    if 'base64' in head.lower(): return base64.b64decode(data).decode()
    return urllib.parse.unquote(data) if re.search(r'%[0-9a-fA-F]{2}', data) else data

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--site', required=True); ap.add_argument('--json')
    a = ap.parse_args()
    s = open(os.path.join(a.site, 'scenes', 'manifold.x3d'), encoding='utf-8').read()
    nodes = collections.Counter(re.findall(r'<([A-Z][A-Za-z0-9_]*)\b', s))
    out = {'bytes': len(s.encode()), 'nodes': dict(nodes.most_common()), 'shaders': {}}
    for m in re.finditer(r"<ComposedShader DEF='([^']*)'[^>]*>(.*?)</ComposedShader>", s, re.S):
        d, inner = m.group(1), m.group(2)
        parts = {ty: part_source(src) for ty, src in re.findall(r"<ShaderPart type='(\w+)'><!\[CDATA\[(.*?)\]\]>", inner, re.S)}
        norm = lambda t: re.sub(r'\s+', ' ', t).strip()
        fields = re.findall(r"<field name='(\w+)' type='(\w+)'", inner)
        out['shaders'][d] = {'key': fnv(norm(parts['VERTEX'])) + '-' + fnv(norm(parts['FRAGMENT'])),
                             'vertex_lines': parts['VERTEX'].count('\n') + 1, 'fragment_lines': parts['FRAGMENT'].count('\n') + 1,
                             'uniform_fields': len(fields), 'field_types': dict(collections.Counter(t for _, t in fields))}
    for d, v in out['shaders'].items(): print(f"{d:14s} {v['key']}  vs {v['vertex_lines']:3d} lines  fs {v['fragment_lines']:3d} lines  {v['uniform_fields']} fields {v['field_types']}")
    print('nodes:', ', '.join(f'{k} {n}' for k, n in out['nodes'].items()), '| scene bytes', out['bytes'])
    if a.json: json.dump(out, open(a.json, 'w'), indent=1)
main()
