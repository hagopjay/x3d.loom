// A Python (pycrdt) peer joins the session: JS update bytes in, a field edit made in Python, update bytes back.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import * as Y from 'yjs'
import { X3DDoc } from '../src/yx3d.js'

const have = spawnSync('python3', ['-c', 'import pycrdt']).status === 0
test('pycrdt peer edits a field by DEF and the JS doc converges; JS edit reaches Python', { skip: !have && 'pycrdt not installed (pip install pycrdt)' }, () => {
  const a = new X3DDoc().loadXML('<X3D><Scene><Transform DEF="T" translation="0 0 0"><Shape/></Transform></Scene></X3D>')
  const script = `
import sys, base64, json
sys.path.insert(0, 'python')
from yx3d_py import Peer
p = Peer(base64.b64decode(sys.stdin.readline()))
p.set_field('T', 'translation', '7 8 9')
before = p.get_field('T', 'translation')
upd = p.diff_since(b'\\x00')
js_edit = base64.b64decode(sys.stdin.readline())
p.apply(js_edit)
print(json.dumps({'update': base64.b64encode(upd).decode(), 'after_js_edit': p.get_field('T', 'scale'), 'before': before}))
`
  const t = a.findByDef('T')
  const b64 = u => Buffer.from(u).toString('base64')
  // JS makes an edit while Python is working: send it as a second update
  const first = Y.encodeStateAsUpdate(a.doc)
  const sv = Y.encodeStateVector(a.doc)
  a.setField(t, 'scale', '2 2 2')
  const edit = Y.encodeStateAsUpdate(a.doc, sv)
  const r = spawnSync('python3', ['-I', '-c', script], { input: b64(first) + '\n' + b64(edit) + '\n', encoding: 'utf8', cwd: new URL('..', import.meta.url).pathname, env: { ...process.env, PYTHONPATH: '' } })
  assert.equal(r.status, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  assert.equal(out.after_js_edit, '2 2 2')
  Y.applyUpdate(a.doc, Buffer.from(out.update, 'base64'))
  assert.equal(a.getField(t, 'translation'), '7 8 9')
  assert.equal(a.getField(t, 'scale'), '2 2 2')
})
