// yx3d: an X3D scene graph as a Yjs CRDT.   (ID prefix for this track: YJS-)
//
// Layout of the Y.Doc (top-level shared types, so peers that init separately still merge):
//   x3d.meta   Y.Map   profile, version, head (X3D header attrs), components (JSON string)
//   x3d.nodes  Y.Map   uid -> Y.Map { type, def, use, at, text, fields: Y.Map, kids: Y.Array<uid> }
//   x3d.roots  Y.Array uid                    children of <Scene>, in order
//   x3d.routes Y.Map   rid -> Y.Map { from: uid, fromField, to: uid, toField }
//
// Why a flat node table: a node's fields live in nodes[uid] and never move, so a field
// edit made while another peer reparents the node is not lost (a nested tree loses it:
// "move" would be delete + insert of a Y.Map). The tree is the pair (parent register,
// kids order hints): `at` = "parentUid|slot" is a last-writer-wins register, so concurrent
// moves of one node resolve to ONE parent; kids arrays only order siblings. Materialising
// walks from `roots`, takes a uid under a parent only if its `at` agrees, dedupes, and drops
// whatever the walk cannot reach (cycles from concurrent moves, subtrees of deleted nodes).
import * as Y from 'yjs'

export const ROOT = '#scene'
// SFNode slots: one child at most. Concurrent adds leave two; the walk keeps the first
// (array order, which Yjs makes the same on every peer) and reports the rest as conflicts.
export const SFNODE_SLOTS = new Set(['appearance', 'geometry', 'material', 'texture', 'textureTransform', 'fontStyle',
  'coord', 'color', 'normal', 'texCoord', 'fillProperties', 'lineProperties', 'metadata', 'source', 'body', 'collider',
  'viewpoint', 'skin', 'proxy', 'sensor', 'shape', 'emitter', 'volumeData', 'renderStyle', 'segmentIdentifiers'])

let _n = 0
export function newUid(doc) { return doc.clientID.toString(36) + '.' + (_n++).toString(36) + '.' + Date.now().toString(36).slice(-3) }

// ---------------------------------------------------------------- XML in (no DOM, no deps)
export function parseXML(src) {
  src = src.replace(/<\?xml[^>]*\?>/g, '').replace(/<!DOCTYPE[^>]*>/g, '').replace(/<!--[\s\S]*?-->/g, '')
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g
  const root = { name: '#root', attrs: {}, kids: [], text: '' }
  const stack = [root]
  let m
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1]
    if (m[1] !== undefined) top.text += m[1]
    else if (m[2]) { stack.pop() }
    else {
      const attrs = {}
      m[4].replace(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, (_, k, a, b) => { attrs[k] = unesc(a ?? b) })
      const el = { name: m[3], attrs, kids: [], text: '' }
      top.kids.push(el)
      if (!m[5]) stack.push(el)
    }
  }
  return root.kids[0]
}
const unesc = s => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

// ---------------------------------------------------------------- the model
export class X3DDoc {
  constructor(ydoc = new Y.Doc()) {
    this.doc = ydoc
    this.meta = this._sub('meta', Y.Map)
    this.nodes = this._sub('nodes', Y.Map)
    this.roots = this._sub('roots', Y.Array)
    this.routes = this._sub('routes', Y.Map)
  }
  _sub(k) {
    return k === 'roots' ? this.doc.getArray('x3d.roots') : this.doc.getMap('x3d.' + k)
  }
  // ---- import ------------------------------------------------------------
  loadXML(xml, origin = 'load') {
    const x = parseXML(xml)
    if (!x || x.name !== 'X3D') throw new Error('not an X3D document')
    this.doc.transact(() => {
      this.meta.set('profile', x.attrs.profile || 'Full')
      this.meta.set('version', x.attrs.version || '4.0')
      const head = x.kids.find(k => k.name === 'head')
      if (head) this.meta.set('head', JSON.stringify(head.kids.map(k => ({ n: k.name, a: k.attrs }))))
      const scene = x.kids.find(k => k.name === 'Scene')
      const ids = []
      this._defs = new Map()
      const routes = []
      for (const k of scene ? scene.kids : []) { if (k.name === 'ROUTE') routes.push(k.attrs); else ids.push(this._build(k, ROOT, 'children')) }
      this.roots.push(ids)
      for (const r of routes) { const f = this._defs.get(r.fromNode), t = this._defs.get(r.toNode); if (f && t) this.addRoute(f, r.fromField, t, r.toField) }
      this._defs = null
    }, origin)
    return this
  }
  _build(el, parentUid, slot) {
    const uid = newUid(this.doc)
    const n = new Y.Map()
    this.nodes.set(uid, n)
    const a = { ...el.attrs }
    n.set('type', el.name)
    if (a.DEF) { n.set('def', a.DEF); this._defs?.set(a.DEF, uid); delete a.DEF }
    if (a.USE) { n.set('use', a.USE); delete a.USE }
    const cf = a.containerField; delete a.containerField
    n.set('at', parentUid + '|' + (cf || slot))
    if (el.text && el.text.trim()) n.set('text', el.text)
    const f = new Y.Map(); n.set('fields', f)
    for (const [k, v] of Object.entries(a)) f.set(k, v)
    const kids = new Y.Array(); n.set('kids', kids)
    const ids = []
    for (const k of el.kids) {
      ids.push(this._build(k, uid, k.attrs.containerField || defaultSlot(el.name, k.name)))
    }
    kids.push(ids)
    return uid
  }
  // ---- edit ops (each is one transaction; the `origin` tags who did it) ---
  setField(uid, field, value, origin = 'local') {
    this.doc.transact(() => this.nodes.get(uid).get('fields').set(field, String(value)), origin)
  }
  setFields(uid, obj, origin = 'local') {
    this.doc.transact(() => { const f = this.nodes.get(uid).get('fields'); for (const k in obj) f.set(k, String(obj[k])) }, origin)
  }
  delField(uid, field, origin = 'local') { this.doc.transact(() => this.nodes.get(uid).get('fields').delete(field), origin) }
  getField(uid, field) { return this.nodes.get(uid)?.get('fields').get(field) }
  /** add a subtree given as XML text under (parentUid|ROOT, slot) at index (default: end). Returns the new root uid. */
  addXML(xml, parentUid = ROOT, slot = 'children', index = undefined, origin = 'local') {
    const el = parseXML(xml)
    let uid
    this.doc.transact(() => {
      uid = this._build(el, parentUid, el.attrs.containerField || slot)
      const arr = parentUid === ROOT ? this.roots : this.nodes.get(parentUid).get('kids')
      arr.insert(index ?? arr.length, [uid])
    }, origin)
    return uid
  }
  /** delete a node and its whole subtree */
  remove(uid, origin = 'local') {
    this.doc.transact(() => {
      const n = this.nodes.get(uid); if (!n) return
      const [p] = split(n.get('at'))
      const arr = p === ROOT ? this.roots : this.nodes.get(p)?.get('kids')
      if (arr) { const i = arr.toArray().indexOf(uid); if (i >= 0) arr.delete(i, 1) }
      // kids arrays are order hints and can form cycles after concurrent moves: follow only children whose register says they live here, once each
      const seen = new Set()
      const kill = u => { if (seen.has(u)) return; seen.add(u); const x = this.nodes.get(u); if (!x) return; for (const c of x.get('kids').toArray()) if (this.nodes.get(c)?.get('at').startsWith(u + '|')) kill(c); this.nodes.delete(u) }
      kill(uid)
    }, origin)
  }
  /** reparent: LWW on the parent register, order hint inserted in the new parent's kids */
  move(uid, newParent, slot = 'children', index = undefined, origin = 'local') {
    this.doc.transact(() => {
      const n = this.nodes.get(uid)
      const [p] = split(n.get('at'))
      const oldArr = p === ROOT ? this.roots : this.nodes.get(p)?.get('kids')
      if (oldArr) { const i = oldArr.toArray().indexOf(uid); if (i >= 0) oldArr.delete(i, 1) }
      const arr = newParent === ROOT ? this.roots : this.nodes.get(newParent).get('kids')
      arr.insert(index ?? arr.length, [uid])
      n.set('at', newParent + '|' + slot)
    }, origin)
  }
  addRoute(fromUid, fromField, toUid, toField, origin = 'local') {
    const rid = newUid(this.doc)
    this.doc.transact(() => {
      const r = new Y.Map(); r.set('from', fromUid); r.set('fromField', fromField); r.set('to', toUid); r.set('toField', toField)
      this.routes.set(rid, r)
    }, origin)
    return rid
  }
  removeRoute(rid, origin = 'local') { this.doc.transact(() => this.routes.delete(rid), origin) }

  // ---- read: the resolved tree --------------------------------------------
  /** resolved tree: { roots: [node], conflicts: [...], orphans: [uid] } where node = {uid,type,def,use,fields,slot,kids,text} */
  tree() {
    const conflicts = [], seen = new Set()
    const walk = (parent, arr) => {
      const out = [], slotTaken = new Set()
      for (const uid of arr.toArray()) {
        const n = this.nodes.get(uid)
        if (!n) continue
        const [p, slot] = split(n.get('at'))
        if (p !== parent) continue // another peer moved it elsewhere; the register wins
        if (seen.has(uid)) { conflicts.push({ kind: 'duplicate', uid }); continue }
        if (SFNODE_SLOTS.has(slot) && slotTaken.has(slot)) { conflicts.push({ kind: 'sfnode-slot', uid, parent, slot }); continue }
        seen.add(uid); slotTaken.add(slot)
        const f = {}; for (const k of [...n.get('fields').keys()].sort()) f[k] = n.get('fields').get(k) // sorted: Y.Map iteration order is per-replica, an export must not be
        out.push({ uid, type: n.get('type'), def: n.get('def'), use: n.get('use'), text: n.get('text'), slot, fields: f, kids: walk(uid, n.get('kids')) })
      }
      return out
    }
    const roots = walk(ROOT, this.roots)
    const orphans = []; this.nodes.forEach((_, uid) => { if (!seen.has(uid)) orphans.push(uid) })
    // DEF clashes (two peers named different nodes alike): report; export renames deterministically
    const defs = new Map()
    const scan = ns => { for (const n of ns) { if (n.def) { (defs.get(n.def) ?? defs.set(n.def, []).get(n.def)).push(n.uid) } scan(n.kids) } }
    scan(roots)
    for (const [d, us] of defs) if (us.length > 1) conflicts.push({ kind: 'def-clash', def: d, uids: us })
    return { roots, conflicts, orphans, defs }
  }
  /** flat index uid -> {parent, slot, index, type}; the thing adapters diff */
  index() {
    const idx = new Map()
    const go = (ns, parent) => { const c = {}; ns.forEach(n => { const i = c[n.slot] = (c[n.slot] ?? -1) + 1; idx.set(n.uid, { parent, slot: n.slot, index: i, type: n.type }); go(n.kids, n.uid) }) }
    go(this.tree().roots, ROOT)
    return idx
  }
  /** canonical X3D XML text (user DEF names; clashing DEFs get _2, _3 by uid order) */
  toXML({ ids = false, only = null } = {}) {
    const t = this.tree()
    const rename = new Map()
    for (const [d, us] of t.defs) if (us.length > 1) [...us].sort().slice(1).forEach((u, i) => rename.set(u, d + '_' + (i + 2)))
    const byDef = new Map() // def -> uid (first)
    for (const [d, us] of t.defs) byDef.set(d, [...us].sort()[0])
    const defName = n => ids ? 'y_' + n.uid.replace(/\./g, '_') : (rename.get(n.uid) ?? n.def)
    const useName = n => ids ? 'y_' + (byDef.get(n.use) ?? '').replace(/\./g, '_') : n.use
    const el = (n, parentType) => {
      const a = []
      if (n.use) a.push(`USE="${esc(useName(n))}"`)
      else if (n.def || ids) a.push(`DEF="${esc(ids ? 'y_' + n.uid.replace(/\./g, '_') : defName(n))}"`)
      for (const k in n.fields) a.push(`${k}="${esc(n.fields[k])}"`)
      if (parentType !== '#' && n.slot !== defaultSlot(parentType, n.type)) a.push(`containerField="${esc(n.slot)}"`)
      const inner = n.kids.map(c => el(c, n.type)).join('')
      const body = n.text ? `<![CDATA[${n.text}]]>` + inner : inner
      return `<${n.type}${a.length ? ' ' + a.join(' ') : ''}${body ? '>' + body + `</${n.type}>` : '/>'}`
    }
    const uidDef = new Map(); const walkU = ns => ns.forEach(n => { uidDef.set(n.uid, n); walkU(n.kids) }); walkU(t.roots)
    if (only) { const n = uidDef.get(only); return n ? el(n, '#') : null }
    const routes = []
    this.routes.forEach(r => {
      const f = uidDef.get(r.get('from')), to = uidDef.get(r.get('to'))
      if (f && to && (ids || (f.def && to.def))) routes.push(`<ROUTE fromNode="${esc(ids ? 'y_' + f.uid.replace(/\./g, '_') : defName(f))}" fromField="${esc(r.get('fromField'))}" toNode="${esc(ids ? 'y_' + to.uid.replace(/\./g, '_') : defName(to))}" toField="${esc(r.get('toField'))}"/>`)
    })
    const head = this.meta.get('head') ? '<head>' + JSON.parse(this.meta.get('head')).map(h => `<${h.n} ${Object.entries(h.a).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}/>`).join('') + '</head>' : ''
    return `<?xml version="1.0" encoding="UTF-8"?>\n<X3D profile="${this.meta.get('profile') || 'Full'}" version="${this.meta.get('version') || '4.0'}">${head}<Scene>${t.roots.map(n => el(n, 'Scene')).join('')}${routes.join('')}</Scene></X3D>`
  }
  findByDef(def) { const t = this.tree(); for (const [d, us] of t.defs) if (d === def) return us[0] }
  /** subscribe to resolved changes. cb(events, origin) where events are
   *  {kind:'field', uid, field, value, type} | {kind:'added', uid, ...index} | {kind:'removed', uid} | {kind:'moved', uid, from, to} */
  observe(cb) {
    let prev = this.index()
    const h = (tr) => {
      const ev = []
      tr.changed.forEach((keys, type) => {
        const nm = type._item && type._item.parent // the node Y.Map when `type` is its fields map
        if (type._item?.parentSub === 'fields' && nm?._item?.parent === this.nodes) {
          const uid = nm._item.parentSub
          for (const k of keys) ev.push({ kind: 'field', uid, field: k, value: type.get(k), type: nm.get('type') })
        }
      })
      // field-only transactions (the hot path: dragging a node) skip the O(n) structure diff
      let structural = false
      for (const t of tr.changed.keys()) if (t === this.nodes || t === this.roots || t._item?.parentSub === 'kids' || t._item?.parent === this.nodes) { structural = true; break }
      if (!structural) { if (ev.length) cb(ev, tr.origin, tr); return }
      const cur = this.index()
      for (const [uid, c] of cur) {
        const p = prev.get(uid)
        if (!p) ev.push({ kind: 'added', uid, ...c })
        else if (p.parent !== c.parent || p.slot !== c.slot) ev.push({ kind: 'moved', uid, from: p, to: c })
      }
      for (const uid of prev.keys()) if (!cur.has(uid)) ev.push({ kind: 'removed', uid, from: prev.get(uid) })
      prev = cur
      if (ev.length) cb(ev, tr.origin, tr)
    }
    this.doc.on('afterTransaction', h)
    return () => this.doc.off('afterTransaction', h)
  }
}

const split = at => { const i = at.lastIndexOf('|'); return [at.slice(0, i), at.slice(i + 1)] }

// default containerField per (parent, child) for the cases the XML omits it
export function defaultSlot(parent, child) {
  if (child === 'Appearance') return 'appearance'
  if (/^(Material|TwoSidedMaterial|PhysicalMaterial|UnlitMaterial)$/.test(child)) return 'material'
  if (/Texture$|^MultiTexture$|^ComposedTexture3D$/.test(child) && child !== 'TextureTransform') return 'texture'
  if (/^TextureTransform/.test(child)) return 'textureTransform'
  if (/^(Coordinate|CoordinateDouble)$/.test(child)) return 'coord'
  if (/^Color(RGBA)?$/.test(child)) return 'color'
  if (child === 'Normal') return 'normal'
  if (/^TextureCoordinate/.test(child)) return 'texCoord'
  if (child === 'FontStyle') return 'fontStyle'
  if (/^(Box|Sphere|Cone|Cylinder|IndexedFaceSet|IndexedLineSet|IndexedTriangleSet|IndexedTriangleStripSet|IndexedTriangleFanSet|TriangleSet|PointSet|LineSet|ElevationGrid|Extrusion|Text|NurbsCurve|NurbsPatchSurface|QuadSet|IndexedQuadSet|Rectangle2D|Circle2D|Disk2D|Arc2D|ArcClose2D|Polyline2D|Polypoint2D|TriangleSet2D|TriangleFanSet|TriangleStripSet)$/.test(child) && /^Shape$/.test(parent)) return 'geometry'
  if (child === 'Shape' && parent === 'Collision') return 'children'
  if (/^Metadata/.test(child)) return 'metadata'
  return 'children'
}
