// Applies yx3d change events to a live X3D browser through the SAI: X_ITE, or the x3d.loom bridges (Babylon,
// three.js), whose shim speaks the same SAI subset. One class, two modes, picked by probing the first node
// (`getField` exists in X_ITE only): see MODE below. No engine code is touched:
// field edits are `field.fromString`, structure edits are MFNode push/splice and SFNode assignment.
// Every node is rendered with DEF "y_<uid>" so the adapter can find it again (canonical export keeps user DEFs).
import { ROOT } from './yx3d.js'
const SFNODE_T = [1021, 'SFNode'], MFNODE_T = [1044, 'MFNode']
const SFNODE = 1021, MFNODE = 1044 // X3D.X3DConstants.SFNode / MFNode in X_ITE 16.6.0 (probed, not documented in the .d.ts)
// node-valued fields of a SAI node, by definition (getFieldDefinitions is the portable route: no getFields() in this SAI)
const nodeFields = n => { const out = [], defs = n.getFieldDefinitions(); for (let i = 0; i < defs.length; i++) { const d = defs[i]; if (/^(add|remove|set_)/.test(d.name) && typeof n[d.name] === 'undefined') continue; if (SFNODE_T.includes(d.dataType)) out.push({ name: d.name, sf: true }); else if (MFNODE_T.includes(d.dataType)) out.push({ name: d.name, sf: false }) } return out }

// string -> SAI value for the bridge shim (X_ITE parses strings itself). null = not handled, the caller reloads.
export function parseValue(type, str) {
  const nums = () => str.trim().split(/[\s,]+/).filter(Boolean).map(Number)
  switch (type) {
    case 'SFBool': return /true/i.test(str)
    case 'SFFloat': case 'SFDouble': case 'SFTime': case 'SFInt32': return Number(str)
    case 'SFString': return str
    case 'SFVec2f': case 'SFVec3f': case 'SFVec4f': case 'SFColor': case 'SFColorRGBA': case 'SFRotation': return nums()
    case 'MFFloat': case 'MFInt32': case 'MFDouble': case 'MFTime': return nums()
    case 'MFString': { const m = str.match(/"((?:[^"\\]|\\.)*)"/g); return m ? m.map(x => x.slice(1, -1)) : (str.trim() ? [str.trim()] : []) }
    default: return null
  }
}
export class SaiAdapter {
  constructor(xdoc, browser) { this.x = xdoc; this.b = browser; this.map = new Map(); this.stats = { fields: 0, added: 0, removed: 0, moved: 0, reloads: 0 }; this.mode = null }
  /** MODE 'xite': real SAI, granular add/remove/move. MODE 'bridge': the loom shim; field edits and appends are granular, remove/move/insert reload the world (counted in stats.reloads) */
  async load(firstTime = true) {
    const scene = await this.b.createX3DFromString(this.x.toXML({ ids: true }))
    await this.b.replaceWorld(scene)
    this.map.clear(); this._index(scene, this.x.tree().roots)
    this.stats.reloads++
    this.mode = this.mode || (this.map.size && typeof [...this.map.values()][0].getField === 'function' ? 'xite' : 'bridge')
    if (!firstTime) return this
    this.off?.(); this.off = this.x.observe((ev, origin) => { this.queue = (this.queue || Promise.resolve()).then(() => this.apply(ev, origin)) })
    return this
  }
  _index(scene, nodes) { for (const n of nodes) { const sn = scene.getNamedNode('y_' + n.uid.replace(/\./g, '_')); if (sn) this.map.set(n.uid, sn); this._index(scene, n.kids) } }
  /** resolves when every queued remote change has been applied */
  idle() { return this.queue || Promise.resolve() }
  get scene() { return this.b.currentScene }
  _container(parentUid, slot) {
    if (parentUid === ROOT) return { mf: this.scene.rootNodes }
    const p = this.map.get(parentUid); if (!p) return null
    if (p.getField) { const f = p.getField(slot); return f.getType() === SFNODE ? { sf: p, name: slot } : { mf: f } }
    const d = p.getFieldDefinitions().find(d => d.name === slot)
    return d && SFNODE_T.includes(d.dataType) ? { sf: p, name: slot } : { mf: p[slot] }
  }
  async apply(events) {
    let reloaded = false
    const gone = new Set(events.filter(e => e.kind === 'removed').map(e => e.uid))
    for (const e of events) {
      try {
        if (e.kind === 'field') {
          const n = this.map.get(e.uid); if (!n) continue
          if (e.value === undefined) continue
          if (this.mode === 'xite') n.getField(e.field).fromString(e.value, this.scene)
          else {
            const d = n.getFieldDefinitions().find(d => d.name === e.field); const v = d && parseValue(d.dataType, e.value)
            if (v == null) { await this.load(false); continue }
            n[e.field] = v
          }
          this.stats.fields++
        } else if (this.mode === 'bridge' && (e.kind === 'removed' || e.kind === 'moved' || (e.kind === 'added' && !this._appendable(e)))) {
          if (!reloaded) { await this.load(false); reloaded = true }
          this.stats[e.kind]++
        } else if (e.kind === 'removed' || e.kind === 'moved') {
          const n = this.map.get(e.uid); if (!n) continue
          const from = e.kind === 'moved' ? e.from : this._prevLoc?.get(e.uid)
          if (e.kind === 'removed') { if (!gone.has(e.from?.parent)) await this._detach(n); // a removed subtree leaves with its top node
             this.map.delete(e.uid); this.stats.removed++ }
          else { await this._detach(n, from); this._attach(e.uid, n, e.to); this.stats.moved++ }
        } else if (e.kind === 'added') {
          if (this.map.has(e.uid)) continue
          const xml = this.x.toXML({ ids: true, only: e.uid })
          if (!xml) continue
          // the new subtree also brings its descendants; they get their own `added` events, skipped by the has() check
          const tmp = await this.b.createX3DFromString(`<X3D profile="Full" version="4.0"><Scene>${xml}</Scene></X3D>`)
          const sn = tmp.rootNodes[0]
          this.map.set(e.uid, sn)
          const walk = (nodes) => { for (const k of nodes) { const x = tmp.getNamedNode('y_' + k.uid.replace(/\./g, '_')); if (x) this.map.set(k.uid, x); walk(k.kids) } }
          const t = this._find(e.uid); if (t) walk(t.kids)
          this._attach(e.uid, sn, e)
          this.stats.added++
        }
      } catch (err) { this.stats.error = String(err && err.message || err); this.stats.lastFail = e }
    }
  }
  _appendable(e) {
    if (this.map.has(e.uid)) return true // a descendant of a subtree that came in whole
    if (e.parent === ROOT) return false
    const p = this._find(e.parent); const sib = p ? p.kids.filter(k => k.slot === e.slot) : []
    return sib.length && sib[sib.length - 1].uid === e.uid
  }
  _find(uid) { const g = ns => { for (const n of ns) { if (n.uid === uid) return n; const r = g(n.kids); if (r) return r } }; return g(this.x.tree().roots) }
  // SAI wrappers are not identity-stable (each access can make a new JS object), so match on the DEF name
  async _detach(n) {
    const name = n.getNodeName()
    const rm = arr => { for (let i = 0; i < arr.length; i++) if (arr[i] && arr[i].getNodeName() === name) { arr.splice(i, 1); return true } return false }
    if (rm(this.scene.rootNodes)) return
    for (const x of this.map.values()) for (const f of nodeFields(x)) {
      if (!f.sf && rm(x[f.name])) return
      if (f.sf) { const v = x[f.name]; if (v && v.getNodeName() === name) { x[f.name] = null; return } }
    }
    throw new Error('detach: ' + name + ' not found')
  }
  /** names of every node reachable from the scene roots: what X_ITE really holds */
  snapshot() {
    const out = []
    const go = n => { if (!n) return; out.push(n.getNodeName()); for (const f of nodeFields(n)) { if (f.sf) go(n[f.name]); else { const l = n[f.name]; for (let i = 0; i < l.length; i++) go(l[i]) } } }
    for (const r of this.scene.rootNodes) go(r)
    return out.filter(x => x.startsWith('y_')).sort()
  }
  _attach(uid, node, loc) {
    const c = this._container(loc.parent, loc.slot); if (!c) return
    if (this.mode === 'bridge' && loc.parent === ROOT) return this.scene.addRootNode(node)
    if (c.sf) c.sf[c.name] = node // property access hands back real SAI nodes; field.getValue() returns internals
    else if (this.mode === 'bridge') c.mf.push(node)
    else { const i = Math.min(loc.index ?? c.mf.length, c.mf.length); c.mf.splice(i, 0, node) }
  }
}

export { SaiAdapter as XiteAdapter }
