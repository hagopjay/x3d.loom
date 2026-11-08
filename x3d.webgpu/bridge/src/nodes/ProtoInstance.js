/* ProtoInstance (Core level 2): ProtoInstance can override field default values via fieldValue initializations. Non-recursive nested ProtoInstance and ProtoDeclare statements are allowed within a ProtoDeclare.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written.

   The reader had no PROTO support, so a ProtoInstance is expanded before parsing (spec.preparse): the scene text is read as XML, every <ProtoDeclare> is taken out, and every
   <ProtoInstance> is replaced by a copy of the declaration's <ProtoBody> in which
     - DEF and USE names (and the ROUTEs between them) get a prefix that is unique to the instance, so two instances never share a name;
     - the first node of the body takes the instance's DEF and containerField (it is the node the instance stands for; the other top-level nodes of the body follow it);
     - an <IS><connect nodeField protoField/></IS> becomes the value: the fieldValue the instance gives, else the default of the <field>, written as an attribute (SF and MF values) or as a child
       node with containerField=nodeField (SFNode and MFNode); the events of the field are connected to the node's field: ROUTEs in the scene that name the instance's field are rewritten to the
       inner node's field (an input reaches every node connected to it);
     - nested ProtoInstances in the body are expanded the same way (depth limit 12; a PROTO cannot contain itself).
   After parsing (spec.postparse) the node that stands for an instance gets the PROTO's field names too, so the page's SAI can set, read and listen to them (node.fdefs, node.protoIn,
   node.protoOut; the kit's receive and events.emit forward). */
BR.node('ProtoInstance', {
  component: 'Core', level: 2,
  container: 'children',
  defs: {
    fieldValue: ['MFNode', IO, []],
    metadata: ['SFNode', IO, null],
    name: ['SFString', IO, ""],
  },
  preparse(text) { return /<ProtoInstance[\s>\/]/.test(text) ? BR.proto.expand(text) : text; },
  postparse(w) { BR.proto.connect(w); },
});

BR.proto = {
  pending: [],                           // [{ def, fields: { name: { type, access, value, targets: [{ def, field }] } } }] of the last expansion, consumed by connect()
  expand(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror')[0]) return text;                // the stock parser reports it
    const scene = [...doc.documentElement.children].find((e) => e.nodeName === 'Scene'); if (!scene) return text;
    const P = BR.proto, warn = (m) => (P.warnings ||= []).push(m);
    P.pending = []; P.warnings = []; P.done = new WeakSet();
    const inst = new Map(), uid = { n: 0 };                                        // final DEF of an instance -> its connected fields; the element name of its first node
    P.run(doc, scene, new Map(), 0, inst, uid, warn);
    P.routes(doc, inst, warn);                                                     // ROUTEs outside every instance (the ones inside were done as each instance was built)
    for (const [def, rec] of inst) P.pending.push({ def, fields: rec.fields });
    return new XMLSerializer().serializeToString(doc);
  },
  /* the instance field a ROUTE names: the field itself, or set_x / x_changed for an inputOutput field */
  pick(fields, name, dir) {
    if (fields[name]) return name;
    if (dir === 'in' && name.startsWith('set_') && fields[name.slice(4)]) return name.slice(4);
    if (dir === 'out' && name.endsWith('_changed') && fields[name.slice(0, -8)]) return name.slice(0, -8);
    return name;
  },
  /* ROUTEs that name an instance's field now name the inner node's field. Run for the ROUTEs inside a body right after its nested instances are built (the instance's DEF is the same
     name as its first node's, so the nested record must be read before the outer one replaces it), and once more for the rest of the scene. Each ROUTE is rewritten once. */
  routes(root, inst, warn) {
    const P = BR.proto, done = (P.done ||= new WeakSet());
    for (const r of [...root.getElementsByTagName('ROUTE')]) {
      if (done.has(r)) continue; done.add(r);
      for (const [end, nodeAttr, fieldAttr] of [['to', 'toNode', 'toField'], ['from', 'fromNode', 'fromField']]) {
        const rec = inst.get(r.getAttribute(nodeAttr)); if (!rec) continue;
        const pf = r.getAttribute(fieldAttr), key = P.pick(rec.fields, pf, end === 'to' ? 'in' : 'out'), f = rec.fields[key];
        if (!f || !f.targets.length) { warn(`ROUTE ${r.getAttribute('fromNode')}.${r.getAttribute('fromField')} -> ${r.getAttribute('toNode')}.${r.getAttribute('toField')}: the PROTO has no connected field ${pf}`); continue; }
        const live = f.targets.filter((t) => (end === 'to' ? t.access !== 'outputOnly' : t.access !== 'inputOnly')), use = live.length ? live : f.targets;
        r.setAttribute(nodeAttr, use[0].def); r.setAttribute(fieldAttr, use[0].field);
        for (const extra of use.slice(1)) { const c = r.cloneNode(true); c.setAttribute(nodeAttr, extra.def); c.setAttribute(fieldAttr, extra.field); done.add(c); r.parentNode.insertBefore(c, r.nextSibling); }
      }
    }
  },
  /* one level of statements: declare, instantiate, descend into everything else (a Group's children, an instance's fieldValue nodes) */
  run(doc, parent, protos, depth, inst, uid, warn) {
    const scope = new Map(protos);
    for (const el of [...parent.children]) {
      const tag = el.nodeName;
      if (tag === 'ProtoDeclare') { scope.set(el.getAttribute('name'), el); parent.removeChild(el); }
      else if (tag === 'ExternProtoDeclare') { scope.set(el.getAttribute('name'), null); parent.removeChild(el); warn('ExternProtoDeclare ' + el.getAttribute('name') + ' is not supported (external files are not loaded)'); }
    }
    for (const el of [...parent.children]) {
      if (el.nodeName === 'ProtoInstance') {
        const out = BR.proto.instantiate(doc, el, scope, depth, inst, uid, warn);
        for (const n of out) parent.insertBefore(n, el);
        parent.removeChild(el);
      } else if (el.nodeName !== 'IS') BR.proto.run(doc, el, scope, depth, inst, uid, warn);
    }
  },
  instantiate(doc, el, scope, depth, inst, uid, warn) {
    const name = el.getAttribute('name'), decl = scope.get(name);
    if (el.getAttribute('USE')) {                                                   // <ProtoInstance USE="x"/> is a USE of the node that stands for x
      const rec = inst.get(el.getAttribute('USE'));
      if (!rec) { warn('ProtoInstance USE ' + el.getAttribute('USE') + ' names no instance'); return []; }
      const u = doc.createElement(rec.tag); u.setAttribute('USE', el.getAttribute('USE')); if (el.getAttribute('containerField')) u.setAttribute('containerField', el.getAttribute('containerField')); return [u];
    }
    if (!decl) { warn('ProtoInstance ' + name + ': ' + (decl === null ? 'declared by ExternProtoDeclare, not loaded' : 'no ProtoDeclare of that name')); return []; }
    if (depth > 12) { warn('ProtoInstance ' + name + ': nesting deeper than 12, probably a PROTO that contains itself'); return []; }
    const kids = (e, tag) => [...e.children].filter((c) => c.nodeName === tag);
    const iface = decl.getElementsByTagName('ProtoInterface')[0], body = kids(decl, 'ProtoBody')[0];
    if (!body) { warn('ProtoDeclare ' + name + ' has no ProtoBody'); return []; }
    // the fields: declared defaults, replaced by the instance's fieldValue
    const fields = {};
    for (const f of iface ? kids(iface, 'field') : []) {
      fields[f.getAttribute('name')] = { type: f.getAttribute('type'), access: f.getAttribute('accessType') || 'initializeOnly', value: f.hasAttribute('value') ? f.getAttribute('value') : null, nodes: [...f.children].filter((c) => c.nodeName !== 'IS'), targets: [] };
    }
    for (const fv of kids(el, 'fieldValue')) {
      const f = fields[fv.getAttribute('name')]; if (!f) { warn(`ProtoInstance ${name}: no field ${fv.getAttribute('name')}`); continue; }
      BR.proto.run(doc, fv, scope, depth, inst, uid, warn);                         // instances inside a fieldValue first
      if (fv.hasAttribute('value')) { f.value = fv.getAttribute('value'); f.nodes = []; } else { f.nodes = [...fv.children]; f.value = null; }
    }
    // names: every DEF in the body is prefixed with this instance's number, the body's first node takes the instance's DEF
    const id = 'P' + (++uid.n) + '_', map = new Map(), tops = [...body.children], first = tops.find((c) => !/^(ProtoDeclare|ExternProtoDeclare|ROUTE|IMPORT|EXPORT)$/.test(c.nodeName));
    const instDef = el.getAttribute('DEF');
    for (const d of body.querySelectorAll('[DEF]')) if (!map.has(d.getAttribute('DEF'))) map.set(d.getAttribute('DEF'), id + d.getAttribute('DEF'));
    if (first && instDef && first.getAttribute('DEF')) map.set(first.getAttribute('DEF'), instDef);
    const box = doc.createElement('ProtoBody'); let k = 0;
    for (const t of tops) box.appendChild(t.cloneNode(true));
    const firstClone = first ? box.children[tops.indexOf(first)] : null;
    if (firstClone && instDef) firstClone.setAttribute('DEF', instDef);
    const ctx = { fields, map, id, nextDef: () => id + 'n' + (++k), doc, warn, skip: new Set(), isFirst: firstClone };
    for (const c of [...box.children]) BR.proto.sub(c, ctx);
    BR.proto.run(doc, box, scope, depth + 1, inst, uid, warn);                      // nested ProtoDeclare and ProtoInstance
    BR.proto.routes(box, inst, warn);
    const out = [...box.children];
    // the node that stands for the instance: the first body node, or, when that was itself a ProtoInstance, the first node of its expansion (it carries the DEF given above)
    const head = !firstClone ? null : firstClone.parentNode === box ? firstClone : out.find((c) => c.getAttribute('DEF') === firstClone.getAttribute('DEF')) || null;
    if (head && el.getAttribute('containerField')) head.setAttribute('containerField', el.getAttribute('containerField'));
    if (head && head.getAttribute('DEF')) {
      const rec = { tag: head.nodeName, fields };
      inst.set(head.getAttribute('DEF'), rec);
    }
    return out;
  },
  /* names and IS inside one cloned body element (not into nested declarations: they keep their own scope) */
  sub(e, ctx) {
    const m = ctx.map;
    if (e.nodeName === 'ProtoDeclare' || e.nodeName === 'ExternProtoDeclare') return;
    if (e.hasAttribute('DEF') && m.has(e.getAttribute('DEF'))) e.setAttribute('DEF', m.get(e.getAttribute('DEF')));
    if (e.hasAttribute('USE') && m.has(e.getAttribute('USE'))) e.setAttribute('USE', m.get(e.getAttribute('USE')));
    if (e.nodeName === 'ROUTE') for (const a of ['fromNode', 'toNode']) if (m.has(e.getAttribute(a))) e.setAttribute(a, m.get(e.getAttribute(a)));
    const kids = [...e.children];
    for (const c of kids) if (c.nodeName !== 'IS') BR.proto.sub(c, ctx);
    const is = kids.find((c) => c.nodeName === 'IS');
    if (!is) return;
    e.removeChild(is);
    for (const c of [...is.children]) if (c.nodeName === 'connect') BR.proto.connectField(e, c.getAttribute('nodeField'), c.getAttribute('protoField'), ctx);
  },
  connectField(e, nodeField, protoField, ctx) {
    const f = ctx.fields[protoField];
    if (!f) { ctx.warn(`IS: the PROTO has no field ${protoField}`); return; }
    const isScriptField = e.nodeName === 'field', host = isScriptField ? e.parentNode : e;
    const carries = f.access === 'initializeOnly' || f.access === 'inputOutput';
    if (carries && e.nodeName === 'ProtoInstance') {                                // a nested instance takes the value through a fieldValue
      const fv = ctx.doc.createElement('fieldValue'); fv.setAttribute('name', nodeField);
      if (f.value !== null) fv.setAttribute('value', f.value); else for (const n of f.nodes) fv.appendChild(n.cloneNode(true));
      if (f.value !== null || f.nodes.length) e.appendChild(fv);
      return;
    }
    if (carries) {
      if (/^(SF|MF)Node$/.test(f.type)) {
        for (const n of f.type === 'SFNode' ? f.nodes.slice(0, 1) : f.nodes) { const c = n.cloneNode(true); c.setAttribute('containerField', nodeField); e.appendChild(c); }
      } else if (f.value !== null) e.setAttribute(isScriptField ? 'value' : nodeField, f.value);
    }
    if (f.access !== 'initializeOnly' && !/Node$/.test(f.type)) {                    // events: the node needs a DEF so a ROUTE can name it
      if (!host.getAttribute('DEF')) host.setAttribute('DEF', ctx.nextDef());
      f.targets.push({ def: host.getAttribute('DEF'), field: isScriptField ? e.getAttribute('name') : nodeField, access: f.access });
    }
  },
  /* after parsing: the node that stands for an instance answers to the PROTO's field names */
  connect(w) {
    const pend = BR.proto.pending; BR.proto.pending = [];
    for (const { def, fields } of pend) {
      const n = w.defs.get(def); if (!n) continue;
      n.fdefs = { ...(n.fdefs || DEFS[n.type]) };
      for (const [pf, f] of Object.entries(fields)) {
        if (/Node$/.test(f.type) || !PARSE[f.type]) continue;
        const acc = f.access === 'inputOnly' ? IN : f.access === 'outputOnly' ? OUT : f.access === 'inputOutput' ? IO : IO;
        if (!n.fdefs[pf]) { n.fdefs[pf] = [f.type, acc, null]; n.f[pf] = PARSE[f.type](f.value !== null ? f.value : f.type.startsWith('MF') ? '' : f.type === 'SFBool' ? 'false' : '0'); }
        for (const t of f.targets) {
          const inner = w.defs.get(t.def); if (!inner) continue;
          if (t.access !== 'outputOnly') { (n.protoIn ||= {})[pf] ||= []; if (inner === n && t.field === pf) (n.protoSelf ||= {})[pf] = true; else n.protoIn[pf].push({ node: inner, field: t.field }); }
          if (t.access !== 'inputOnly') ((inner.protoOut ||= {})[t.field] ||= []).push({ inst: n, name: pf });
        }
      }
    }
  },
};
