"""Merge the two kernel runs into what the second reader is given. usage: build_packet.py <sets dir> <score dir>

Reads results-old.json and results-new.json (run_kernel.py) and each set's MANIFEST.json. Writes
  packet.json  one entry per file: role, the author's manifest entry, the XSD result, and every diagnostic of
               either kernel once, with an id. The reader gets this file. It does not say which kernel said what.
  emit.json    id -> ["old"], ["new"] or ["old", "new"]. The reader does not get this file.
Diagnostics are shuffled per file with a fixed seed so their order does not give the kernel away."""
import json, os, random, sys
sets, score = sys.argv[1:3]
old = json.load(open(f'{score}/results-old.json'))['files']
new = json.load(open(f'{score}/results-new.json'))['files']
packet, emit, n = [], {}, 0
for f in sorted(new):
    s, name = f.split('/')
    folder = f'{sets}/set-{s}' if os.path.isdir(f'{sets}/set-{s}') else f'{sets}/{s}'
    man = json.load(open(f'{folder}/MANIFEST.json')).get(name, {})
    role = name.split('-')[0]
    if role not in ('fault', 'twin', 'decoy'):
        print('left out of the packet (a helper file an Inline points at, not a test file):', f)
        continue
    seen = {}
    for k, res in (('old', old), ('new', new)):
        for d in res[f]['semantic']:
            key = (d['level'], d['check'], d['message'], d.get('DEF', ''))
            seen.setdefault(key, []).append(k)
    items = sorted(seen.items())
    random.Random(f).shuffle(items)
    diags = []
    for (level, check, message, _), who in items:
        n += 1
        i = f'd{n:04d}'
        emit[i] = sorted(set(who), key=('old', 'new').index)
        diags.append(dict(id=i, level=level, check=check, message=message))
    x_new, x_old = new[f]['xsd'], old[f]['xsd']
    packet.append(dict(file=f, role=role, manifest=man, xsd_valid=x_new.get('valid'), xsd_valid_oldkernel=x_old.get('valid'),
                       xsd_errors=(x_new.get('errors') or [])[:5], diagnostics=diags))
json.dump(packet, open(f'{score}/packet.json', 'w'), indent=1, default=str)
json.dump(emit, open(f'{score}/emit.json', 'w'), indent=1)
print(len(packet), 'files', n, 'diagnostics', sum(len(v) == 2 for v in emit.values()), 'from both kernels,',
      sum(v == ['new'] for v in emit.values()), 'new only,', sum(v == ['old'] for v in emit.values()), 'old only')
