// ===== x3dio.js : the level as a standard X3D 4.0 RigidBodyPhysics file, out and back in =====
const X3D_LIMITS = Object.freeze({ bytes: 2 * 1024 * 1024, bodies: 900, joints: 2400, zones: 512, parts: 250, coordinate: 10000, pillSamples: 128 });
function xneed(condition, code, detail) { if (!condition) throw new Error(code + ': ' + detail); }
function xnumber(v, lo, hi, name, integer = false) { xneed(typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi && (!integer || Number.isInteger(v)), 'X3D_NUMBER', name + ' must be ' + (integer ? 'an integer ' : '') + 'in [' + lo + ', ' + hi + ']'); return v; }
function xid(v, name) { xneed(typeof v === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,95}$/.test(v), 'X3D_ID', name + ' must be a local identifier (letter/underscore, then letters/digits/underscore; max 96)'); return v; }
function xtext(v, name, limit = 600) { xneed(typeof v === 'string' && v.length <= limit && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v), 'X3D_TEXT', name + ' is too long or contains control characters'); }
function xkeys(value, allowed, name) { xneed(value && typeof value === 'object' && !Array.isArray(value), 'X3D_STRUCTURE', name + ' must be an object'); for (const key of Object.keys(value)) xneed(allowed.includes(key), 'X3D_UNSUPPORTED_FIELD', name + '.' + key + ' cannot be preserved by this bridge'); }
function validatePart(kind, values = {}) {
  xneed(Object.prototype.hasOwnProperty.call(PREFABS, kind), 'X3D_PART_KIND', 'Unsupported prefab ' + kind);
  xneed(values && typeof values === 'object' && !Array.isArray(values), 'X3D_PART_PARAMS', 'Part parameters must be an object');
  const allowed = new Set(['x', 'y', ...Object.keys(PREFABS[kind].d)]), p = Object.assign({}, PREFABS[kind].d, values);
  for (const [key, value] of Object.entries(values)) {
    xneed(allowed.has(key), 'X3D_PART_FIELD', kind + ' does not have parameter ' + key);
    if (['name', 'title', 'text'].includes(key)) xtext(value, kind + '.' + key); else xnumber(value, -10000, 10000, kind + '.' + key);
  }
  for (const key of ['cols', 'rows', 'count', 'strands', 'links', 'planks']) if (p[key] !== undefined) xnumber(p[key], 1, key === 'count' ? 150 : 80, kind + '.' + key, true);
  for (const key of ['w', 'h', 'r', 'size', 'length', 'height', 'thick', 'spacing', 'depth']) if (p[key] !== undefined) xnumber(p[key], 0.001, 1000, kind + '.' + key);
  if (p.mass !== undefined) xnumber(p.mass, 0.001, 100000, kind + '.mass');
  if (p.bounce !== undefined) xnumber(p.bounce, 0, 1.3, kind + '.bounce');
  if (p.softness !== undefined) xnumber(p.softness, 0, 1, kind + '.softness');
  if (p.period !== undefined) xnumber(p.period, 0.1, 120, kind + '.period');
  if (kind === 'cannon') { xnumber(p.angle, 5, 88, 'cannon.angle'); xnumber(p.power, 8, 48, 'cannon.power'); }
  if (p.cols !== undefined && p.rows !== undefined) xneed(p.cols * p.rows <= 80, 'X3D_PART_BUDGET', 'cols × rows must not exceed 80');
  if (kind === 'curtain') xneed(p.strands * p.links <= 80 && p.length / p.links > 0.1, 'X3D_PART_BUDGET', 'Curtain needs at most 80 links, each longer than 0.1 m');
  if (kind === 'bridge') xneed(p.planks <= 30 && p.length / p.planks > 0.04, 'X3D_PART_BUDGET', 'Bridge needs at most 30 positive-width planks');
  if (kind === 'pendulum') xneed(p.links <= 16 && (p.length - p.r) / p.links >= 0.14, 'X3D_PART_BUDGET', 'Pendulum needs at most 16 links, each at least 0.14 m');
  return p;
}
function getLevelStats(L) {
  const bodies = L.bodies || [], xs = bodies.map(b => b.x), ys = bodies.map(b => b.y), shapes = { box: 0, ball: 0, pill: 0 };
  for (const b of bodies) shapes[b.shape || 'box'] = (shapes[b.shape || 'box'] || 0) + 1;
  return { bodies: bodies.length, joints: (L.joints || []).length, zones: (L.zones || []).length, parts: (L.parts || []).length, shapes,
    bounds: bodies.length ? { min: [Math.min(...xs), Math.min(...ys)], max: [Math.max(...xs), Math.max(...ys)], scope: 'Body centres only, not extent or motion containment.' } : null };
}
function validateLevel(L) {
  xneed(L && typeof L === 'object', 'X3D_LEVEL', 'A level must be an object');
  for (const [key, max] of [['bodies', X3D_LIMITS.bodies], ['joints', X3D_LIMITS.joints], ['zones', X3D_LIMITS.zones], ['parts', X3D_LIMITS.parts]]) xneed(Array.isArray(L[key]) && L[key].length <= max, 'X3D_BUDGET', key + ' must be an array with at most ' + max + ' entries');
  xneed(L.bodies.length > 0, 'X3D_EMPTY', 'A level needs at least one body');
  xneed(L.physics && typeof L.physics === 'object', 'X3D_PHYSICS', 'Missing physics settings');
  xkeys(L.physics, ['gravity', 'substeps', 'iters'], 'physics');
  xnumber(L.physics.gravity, 0, 80, 'gravity'); xnumber(L.physics.substeps, 1, 24, 'substeps', true); xnumber(L.physics.iters, 1, 6, 'iterations', true);
  const defs = new Set(['LEVEL', 'VISUAL', 'WORLD']), bodyIds = new Set(), partIds = new Set();
  const addId = (id) => { xid(id, 'DEF'); xneed(!defs.has(id), 'X3D_DUPLICATE_DEF', 'Duplicate/reserved DEF ' + id); defs.add(id); };
  const coord = (v, name) => xnumber(v, -X3D_LIMITS.coordinate, X3D_LIMITS.coordinate, name);
  for (const p of L.parts) { xid(p.id, 'part id'); xneed(!partIds.has(p.id), 'X3D_DUPLICATE_PART', p.id); partIds.add(p.id); validatePart(p.kind, p.p); }
  for (const b of L.bodies) {
    xkeys(b, ['id', 'part', 'role', 'shape', 'x', 'y', 'a', 'w', 'h', 'r', 'hl', 'mass', 'fric', 'rest', 'group', 'buoy', 'wind', 'kin'], 'body');
    addId(b.id); addId('C_' + b.id); bodyIds.add(b.id); coord(b.x, b.id + '.x'); coord(b.y, b.id + '.y'); coord(b.a ?? 0, b.id + '.angle');
    xneed(['box', 'ball', 'pill'].includes(b.shape || 'box'), 'X3D_SHAPE', 'Unsupported shape on ' + b.id);
    if ((b.shape || 'box') === 'box') { xnumber(b.w, 0.001, 1000, b.id + '.width'); xnumber(b.h, 0.001, 1000, b.id + '.height'); }
    else { xnumber(b.r, 0.001, 100, b.id + '.radius'); if (b.shape === 'pill') { xnumber(b.hl, 0, 100, b.id + '.halfLength'); xneed(Math.max(2, Math.ceil(2 * b.hl / b.r) + 1) <= X3D_LIMITS.pillSamples, 'X3D_PILL_BUDGET', b.id + ' expands into too many circle samples'); } }
    xnumber(b.mass ?? 0, 0, 100000, b.id + '.mass');
    for (const [key, lo, hi] of [['fric', 0, 4], ['rest', 0, 1.3], ['buoy', 0, 20], ['wind', 0, 20], ['group', 0, 1000000]]) if (b[key] !== undefined) xnumber(b[key], lo, hi, b.id + '.' + key, key === 'group');
    if (b.role !== undefined) xid(b.role, b.id + '.role');
    if (b.part) xid(b.part, b.id + '.part');
    if (b.kin) for (const [key, v] of Object.entries(b.kin)) { xneed(['x0', 'y0', 'ax', 'ay', 'period', 'spin'].includes(key), 'X3D_KINEMATIC', 'Unknown kinematic parameter ' + key); if (key === 'period') xnumber(v, 0.1, 120, b.id + '.period'); else coord(v, b.id + '.kin.' + key); }
  }
  for (const j of L.joints) {
    xkeys(j, ['id', 'part', 'type', 'a', 'b', 'ax', 'ay', 'bx', 'by', 'min', 'max', 'rest', 'comp', 'damp'], 'joint'); if (j.part) xid(j.part, j.id + '.part');
    addId(j.id); xneed(['hinge', 'spring', 'rope'].includes(j.type), 'X3D_JOINT', 'Unsupported joint ' + j.id);
    xneed(bodyIds.has(j.a) && (!j.b || bodyIds.has(j.b)) && j.a !== j.b, 'X3D_REFERENCE', 'Joint ' + j.id + ' needs distinct existing bodies');
    coord(j.ax, j.id + '.ax'); coord(j.ay, j.id + '.ay');
    for (const key of ['bx', 'by']) if (j[key] !== undefined) coord(j[key], j.id + '.' + key);
    for (const [key, max] of [['comp', 1], ['damp', 1000], ['rest', 10000]]) if (j[key] !== undefined) xnumber(j[key], 0, max, j.id + '.' + key);
    if (j.type === 'hinge' && (j.min != null || j.max != null)) { xnumber(j.min, -PI, PI, j.id + '.min'); xnumber(j.max, -PI, PI, j.id + '.max'); xneed(j.min <= j.max, 'X3D_JOINT_LIMIT', j.id + ' min must not exceed max'); }
  }
  for (const z of L.zones) {
    xkeys(z, ['id', 'part', 'kind', 'x', 'y', 'w', 'h', 'name', 'title', 'text', 'fx', 'fy', 'angle', 'power'], 'region'); if (z.part) xid(z.part, z.id + '.part');
    addId(z.id); xneed(['label', 'fan', 'water', 'ring', 'goal', 'star', 'checkpoint', 'cannon'].includes(z.kind), 'X3D_ZONE', 'Unsupported region ' + z.kind);
    coord(z.x, z.id + '.x'); coord(z.y, z.id + '.y'); xnumber(z.w, 0.001, 1000, z.id + '.width'); xnumber(z.h, 0.001, 1000, z.id + '.height');
    for (const key of ['name', 'title', 'text']) if (z[key] !== undefined) xtext(z[key], z.id + '.' + key);
    if (z.kind === 'fan') { coord(z.fx, z.id + '.fx'); coord(z.fy, z.id + '.fy'); }
    if (z.kind === 'cannon') { xnumber(z.angle, 5, 88, z.id + '.angle'); xnumber(z.power, 8, 48, z.id + '.power'); }
    if (z.kind === 'water') xneed(Math.max(8, Math.round(z.w / 0.25)) <= 1024, 'X3D_WATER_BUDGET', 'Water has more than 1024 columns');
  }
  return { valid: true, stats: getLevelStats(L) };
}
const n4 = (v) => { xneed(typeof v === 'number' && Number.isFinite(v), 'X3D_NUMBER', 'Cannot export a nonfinite number'); return String(v !== 0 && Math.abs(v) < 0.01 ? +v.toPrecision(4) : +v.toFixed(4)); }; // preserve small compliance values
const xesc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&apos;');
function mfs(obj) { // {k:v} -> MFString value  "k=v" "k=v"
  return Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => xesc(JSON.stringify(k + '=' + (typeof v === 'number' ? n4(v) : String(v))))).join(' ');
}
function hex3(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => n4(c / 255)).join(' '); }

function toX3D(L) {
  validateLevel(L);
  const o = [];
  o.push(`<?xml version="1.0" encoding="UTF-8"?>`, `<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 4.0//EN" "https://www.web3d.org/specifications/x3d-4.0.dtd">`,
    `<X3D profile='Immersive' version='4.0' xmlns:xsd='http://www.w3.org/2001/XMLSchema-instance' xsd:noNamespaceSchemaLocation='https://www.web3d.org/specifications/x3d-4.0.xsd'>`,
    `<head>`, `<component name='RigidBodyPhysics' level='2'/>`, `<meta name='title' content='Flop Lab level'/>`,
    `<meta name='description' content='A 2.5D physics course. Bodies, hinges and regions are standard RigidBodyPhysics nodes; what the Flop Lab engine adds is carried in "flop" metadata. Units are metres, kilograms, seconds, radians. All motion is in the XY plane.'/>`,
    `<meta name='generator' content='Flop Lab'/>`, `</head>`, `<Scene>`);
  o.push(`<WorldInfo DEF='LEVEL' title='Flop Lab level'>`, ` <MetadataSet name='flop:parts' containerField='metadata'>`);
  for (const p of L.parts) o.push(`  <MetadataString containerField='value' name='${xesc(p.id)}' value='"${xesc(p.kind)}" ${mfs(p.p)}'/>`);
  o.push(` </MetadataSet>`, `</WorldInfo>`, `<NavigationInfo type='"EXAMINE" "ANY"'/>`, `<Viewpoint description='Whole course' position='80 4 150'/>`, `<Background skyColor='0.02 0.05 0.11'/>`);
  o.push(`<Group DEF='VISUAL'>`);
  for (const b of L.bodies) {
    const col = hex3(ROLE_COLOR[b.role] || '#3fd0ff');
    const geo = b.shape === 'ball' ? `<Sphere radius='${n4(b.r)}'/>` : b.shape === 'pill' ? `<Cylinder radius='${n4(b.r)}' height='${n4(2 * b.hl + 2 * b.r)}'/>` : `<Box size='${n4(b.w)} ${n4(b.h)} 1.2'/>`;
    o.push(` <CollidableShape DEF='C_${b.id}' translation='${n4(b.x)} ${n4(b.y)} 0' rotation='0 0 1 ${n4(b.a || 0)}'><Shape containerField='shape'><Appearance><Material diffuseColor='0.05 0.09 0.16' emissiveColor='${col}'/></Appearance>${geo}</Shape></CollidableShape>`);
  }
  o.push(`</Group>`);
  o.push(`<RigidBodyCollection DEF='WORLD' gravity='0 ${n4(-L.physics.gravity)} 0' iterations='${L.physics.iters}'>`, ` <MetadataString containerField='metadata' name='flop' value='${mfs({ substeps: L.physics.substeps })}'/>`);
  for (const b of L.bodies) {
    const meta = { part: b.part, role: b.role, shape: b.shape === 'pill' ? 'pill' : undefined, fric: b.fric, rest: b.rest, group: b.group || undefined, buoy: b.buoy, wind: b.wind };
    if (b.kin) for (const k of Object.keys(b.kin)) meta['kin_' + k] = b.kin[k];
    const fixed = !(b.mass > 0) || !!b.kin;
    o.push(` <RigidBody DEF='${b.id}' containerField='bodies' position='${n4(b.x)} ${n4(b.y)} 0' orientation='0 0 1 ${n4(b.a || 0)}' mass='${n4(b.mass > 0 ? b.mass : 1)}' fixed='${fixed}'>`,
      `  <MetadataString containerField='metadata' name='flop' value='${mfs(meta)}'/>`, `  <CollidableShape USE='C_${b.id}' containerField='geometry'/>`, ` </RigidBody>`);
  }
  for (const j of L.joints) {
    const bodies = `<RigidBody USE='${j.a}' containerField='body1'/>` + (j.b ? `<RigidBody USE='${j.b}' containerField='body2'/>` : '');
    if (j.type === 'hinge') {
      const lim = j.min !== null && j.min !== undefined ? ` minAngle='${n4(j.min)}' maxAngle='${n4(j.max)}'` : '';
      o.push(` <SingleAxisHingeJoint DEF='${j.id}' containerField='joints' anchorPoint='${n4(j.ax)} ${n4(j.ay)} 0' axis='0 0 1'${lim}>`,
        `  <MetadataString containerField='metadata' name='flop' value='${mfs({ part: j.part, comp: j.comp || undefined, damp: j.damp || undefined, limits: lim ? 1 : 0 })}'/>`, `  ${bodies}`, ` </SingleAxisHingeJoint>`);
    } else {
      o.push(` <BallJoint DEF='${j.id}' containerField='joints' anchorPoint='${n4(j.ax)} ${n4(j.ay)} 0'>`,
        `  <MetadataString containerField='metadata' name='flop' value='${mfs({ part: j.part, type: j.type, bx: j.bx, by: j.by, rest: j.rest, comp: j.comp || undefined, damp: j.damp || undefined })}'/>`, `  ${bodies}`, ` </BallJoint>`);
    }
  }
  o.push(`</RigidBodyCollection>`);
  for (const z of L.zones) {
    const meta = Object.assign({}, z); for (const k of ['id', 'x', 'y', 'w', 'h']) delete meta[k];
    o.push(`<ProximitySensor DEF='${z.id}' center='${n4(z.x)} ${n4(z.y)} 0' size='${n4(z.w)} ${n4(z.h)} 2'><MetadataString containerField='metadata' name='flop' value='${mfs(meta)}'/></ProximitySensor>`);
  }
  o.push(`</Scene>`, `</X3D>`);
  return o.join('\n');
}

const TEXT_KEYS = new Set(['part', 'role', 'shape', 'kind', 'type', 'name', 'title', 'text']);
function readMeta(el, name) { // the MetadataString child called `name` -> { k: v }
  const out = { _first: null };
  for (const m of el.children) {
    if (m.tagName !== 'MetadataString' || m.getAttribute('name') !== name) continue;
    parseMF(m.getAttribute('value') || '', out);
  }
  const keys = {
    RigidBodyCollection: ['substeps'], RigidBody: ['part', 'role', 'shape', 'fric', 'rest', 'group', 'buoy', 'wind', 'kin_x0', 'kin_y0', 'kin_ax', 'kin_ay', 'kin_period', 'kin_spin'],
    SingleAxisHingeJoint: ['part', 'comp', 'damp', 'limits'], BallJoint: ['part', 'type', 'bx', 'by', 'rest', 'comp', 'damp'],
    ProximitySensor: ['part', 'kind', 'name', 'title', 'text', 'fx', 'fy', 'angle', 'power']
  }[el.tagName];
  if (keys) for (const key of Object.keys(out)) xneed(key === '_first' || keys.includes(key), 'X3D_METADATA_KEY', el.tagName + ' has unsupported flop key ' + key);
  return out;
}
function parseMF(v, out) {
  const re = /"((?:[^"\\]|\\.)*)"/g; let m, end = 0;
  while ((m = re.exec(v))) {
    xneed(!v.slice(end, m.index).trim(), 'X3D_METADATA', 'MFString metadata must contain quoted strings'); end = re.lastIndex;
    let s; try { s = JSON.parse('"' + m[1] + '"'); } catch { throw new Error('X3D_METADATA: Invalid MFString escape'); } const i = s.indexOf('=');
    if (i < 0) { if (out._first === null) out._first = s; continue; }
    const k = s.slice(0, i), val = s.slice(i + 1); xneed(!['__proto__', 'prototype', 'constructor', '_first'].includes(k), 'X3D_METADATA_KEY', 'Reserved metadata key'); xneed(!Object.prototype.hasOwnProperty.call(out, k), 'X3D_METADATA_KEY', 'Repeated metadata key ' + k);
    out[k] = TEXT_KEYS.has(k) || val.trim() === '' || isNaN(+val) ? val : +val;
  }
  xneed(!v.slice(end).trim(), 'X3D_METADATA', 'MFString metadata must contain quoted strings');
  return out;
}
const X3D_DECIMAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const nums = (el, attr, def) => { const v = el.getAttribute(attr); if (v === null) return def; const tokens = v.trim().split(/[\s,]+/), values = tokens.map(Number); xneed(v.trim() && values.length === def.length && tokens.every(t => X3D_DECIMAL.test(t)) && values.every(Number.isFinite), 'X3D_VECTOR', el.tagName + '.' + attr + ' needs ' + def.length + ' finite decimal numbers'); return values; };
function xscalar(el, attr, fallback) { const raw = el.getAttribute(attr); if (raw === null) return fallback; xneed(X3D_DECIMAL.test(raw.trim()) && Number.isFinite(+raw), 'X3D_NUMBER', el.tagName + '.' + attr + ' needs one finite decimal number'); return +raw; }

const X3D_ATTRIBUTES = {
  X3D: ['profile', 'version', 'xmlns:xsd', 'xsd:noNamespaceSchemaLocation'], head: [], component: ['name', 'level'], meta: ['name', 'content'], Scene: [],
  WorldInfo: ['DEF', 'title'], MetadataSet: ['containerField', 'name'], MetadataString: ['containerField', 'name', 'value'],
  NavigationInfo: ['type'], Viewpoint: ['description', 'position'], Background: ['skyColor'], Group: ['DEF'],
  CollidableShape: ['DEF', 'USE', 'containerField', 'translation', 'rotation'], Shape: ['containerField'], Appearance: [], Material: ['diffuseColor', 'emissiveColor'],
  Box: ['size'], Sphere: ['radius'], Cylinder: ['radius', 'height'], RigidBodyCollection: ['DEF', 'gravity', 'iterations'],
  RigidBody: ['DEF', 'USE', 'containerField', 'position', 'orientation', 'mass', 'fixed'],
  SingleAxisHingeJoint: ['DEF', 'containerField', 'anchorPoint', 'axis', 'minAngle', 'maxAngle'], BallJoint: ['DEF', 'containerField', 'anchorPoint'], ProximitySensor: ['DEF', 'center', 'size']
};
const X3D_CHILDREN = {
  X3D: ['head', 'Scene'], head: ['component', 'meta'], Scene: ['WorldInfo', 'NavigationInfo', 'Viewpoint', 'Background', 'Group', 'RigidBodyCollection', 'ProximitySensor'],
  WorldInfo: ['MetadataSet'], MetadataSet: ['MetadataString'], Group: ['CollidableShape'], CollidableShape: ['Shape'], Shape: ['Appearance', 'Box', 'Sphere', 'Cylinder'], Appearance: ['Material'],
  RigidBodyCollection: ['MetadataString', 'RigidBody', 'SingleAxisHingeJoint', 'BallJoint'], RigidBody: ['MetadataString', 'CollidableShape'], SingleAxisHingeJoint: ['MetadataString', 'RigidBody'], BallJoint: ['MetadataString', 'RigidBody'], ProximitySensor: ['MetadataString']
};
function x3dPreflight(text) {
  xneed(typeof text === 'string' && new TextEncoder().encode(text).length <= X3D_LIMITS.bytes, 'X3D_BYTES', 'Level source exceeds 2 MiB');
  let clean = text.replace(/^\s*<\?xml\s[^?]*\?>/i, '');
  const own = '<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 4.0//EN" "https://www.web3d.org/specifications/x3d-4.0.dtd">';
  clean = clean.replace(own, '');
  xneed(!/<!DOCTYPE|<!ENTITY|<!\[CDATA\[|<\?/i.test(clean), 'X3D_XML_DECLARATION', 'Only the exporter\'s fixed X3D DOCTYPE and XML declaration are supported; no entities, subsets, CDATA or processing instructions');
  xneed((clean.match(/</g) || []).length <= 24000, 'X3D_NODE_BUDGET', 'Source contains too many XML nodes');
}
function checkX3DDocument(doc) {
  const root = doc.documentElement;
  xneed(root && root.tagName === 'X3D' && root.getAttribute('version') === '4.0', 'X3D_VERSION', 'Expected an X3D 4.0 document');
  xneed(['Immersive', 'Full'].includes(root.getAttribute('profile')), 'X3D_PROFILE', 'Use Immersive or Full with the supported Flop Lab slice');
  xneed(doc.querySelectorAll('Scene').length === 1 && doc.querySelectorAll('RigidBodyCollection').length === 1, 'X3D_STRUCTURE', 'Exactly one Scene and RigidBodyCollection are required');
  const defs = new Map();
  for (const el of doc.querySelectorAll('*')) {
    const tag = el.tagName, attrs = X3D_ATTRIBUTES[tag];
    xneed(attrs, 'X3D_UNSUPPORTED_NODE', 'The Flop Lab importer does not interpret ' + tag);
    for (const a of el.attributes) xneed(attrs.includes(a.name), 'X3D_UNSUPPORTED_FIELD', tag + '.' + a.name + ' is outside this bridge slice');
    for (const child of el.children) xneed((X3D_CHILDREN[tag] || []).includes(child.tagName), 'X3D_CONTAINMENT', child.tagName + ' cannot occur inside ' + tag);
    for (const child of el.childNodes) if (child.nodeType === 3) xneed(!child.textContent.trim(), 'X3D_TEXT_NODE', 'Scene text must be in metadata attributes');
    const def = el.getAttribute('DEF'), use = el.getAttribute('USE');
    if (def !== null) { xid(def, 'DEF'); xneed(!defs.has(def), 'X3D_DUPLICATE_DEF', 'Repeated DEF ' + def); defs.set(def, tag); }
    if (use !== null) { xneed(!def && defs.get(use) === tag && !el.children.length && [...el.attributes].every(a => ['USE', 'containerField'].includes(a.name)), 'X3D_REFERENCE', 'USE must name an earlier same-type DEF and have no overrides: ' + use); }
    if (tag === 'MetadataSet') xneed(el.getAttribute('name') === 'flop:parts', 'X3D_METADATA_KEY', 'Only flop:parts metadata sets are interpreted');
    if (tag === 'MetadataString' && el.parentElement.tagName !== 'MetadataSet') xneed(el.getAttribute('name') === 'flop', 'X3D_METADATA_KEY', 'Only named flop metadata is interpreted here');
    if (tag === 'RigidBody' && !use && el.hasAttribute('fixed')) xneed(['true', 'false'].includes(el.getAttribute('fixed')), 'X3D_BOOLEAN', 'RigidBody.fixed must be true or false');
    if (tag === 'CollidableShape' && !use) { xneed(el.querySelectorAll('Shape').length === 1, 'X3D_GEOMETRY', 'Each CollidableShape needs one Shape'); const p = nums(el, 'translation', [0, 0, 0]), a = nums(el, 'rotation', [0, 0, 1, 0]); xneed(p[2] === 0 && a[0] === 0 && a[1] === 0 && Math.abs(a[2]) === 1, 'X3D_2D_FRAME', 'Collidable geometry must stay in XY with a Z-axis rotation'); }
    if (tag === 'Shape') xneed([...el.children].filter(c => ['Box', 'Sphere', 'Cylinder'].includes(c.tagName)).length === 1 && el.querySelectorAll('Appearance').length <= 1, 'X3D_GEOMETRY', 'Shape needs exactly one supported geometry and at most one Appearance');
    if (tag === 'Material') for (const key of ['diffuseColor', 'emissiveColor']) if (el.hasAttribute(key)) xneed(nums(el, key, [0, 0, 0]).every(x => x >= 0 && x <= 1), 'X3D_COLOR', key + ' must contain three values in [0,1]');
  }
}

function fromX3D(text) {
  x3dPreflight(text);
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error('The X3D is not well-formed XML: ' + err.textContent.replace(/\s+/g, ' ').slice(0, 220));
  checkX3DDocument(doc);
  const rbc = doc.querySelector('RigidBodyCollection');
  if (!rbc) throw new Error('No RigidBodyCollection found. A level needs one, with RigidBody children.');
  const g = nums(rbc, 'gravity', [0, -30, 0]), pm = readMeta(rbc, 'flop');
  xneed(g[0] === 0 && g[2] === 0, 'X3D_2D_FRAME', 'This solver supports only vertical gravity in the XY plane');
  const L = newLevel({ gravity: -g[1], iters: xscalar(rbc, 'iterations', 1), substeps: pm.substeps ?? 8 });
  for (const m of doc.querySelectorAll('MetadataSet[name="flop:parts"] > MetadataString')) {
    const o = parseMF(m.getAttribute('value') || '', { _first: null }), kind = o._first; delete o._first;
    if (kind) { L.parts.push({ id: m.getAttribute('name'), kind, p: o }); const t = /_(\d+)$/.exec(m.getAttribute('name')); if (t) L.seq = Math.max(L.seq, +t[1]); }
  }
  const shapes = new Map();
  for (const c of doc.querySelectorAll('CollidableShape[DEF]')) shapes.set(c.getAttribute('DEF'), c);
  const ids = new Set();
  for (const rb of rbc.querySelectorAll(':scope > RigidBody')) {
    const id = rb.getAttribute('DEF'); if (!id) throw new Error('Every RigidBody needs a DEF name.');
    if (ids.has(id)) throw new Error('Two RigidBody nodes share the DEF "' + id + '".'); ids.add(id);
    const m = readMeta(rb, 'flop'); delete m._first;
    let cs = rb.querySelector('CollidableShape'); if (cs && cs.getAttribute('USE')) cs = shapes.get(cs.getAttribute('USE'));
    if (!cs) throw new Error('RigidBody "' + id + '" has no CollidableShape geometry.');
    const pos = nums(rb, 'position', [0, 0, 0]), rot = nums(rb, 'orientation', [0, 0, 1, 0]);
    xneed(pos[2] === 0 && rot[0] === 0 && rot[1] === 0 && Math.abs(rot[2]) === 1, 'X3D_2D_FRAME', 'Body ' + id + ' needs z=0 and a Z-axis orientation');
    const fixed = rb.getAttribute('fixed') === 'true';
    const declaredMass = xscalar(rb, 'mass', 1); xnumber(declaredMass, 0.001, 100000, id + '.mass');
    const b = { id, part: m.part || id, role: m.role || (fixed ? 'static' : 'crate'), x: pos[0], y: pos[1], a: (rot[2] < 0 ? -1 : 1) * rot[3], mass: fixed ? 0 : declaredMass };
    for (const k of ['fric', 'rest', 'group', 'buoy', 'wind']) if (m[k] !== undefined) b[k] = m[k];
    const kin = {}; let hasKin = false; for (const k of Object.keys(m)) if (k.startsWith('kin_')) { kin[k.slice(4)] = m[k]; hasKin = true; }
    if (hasKin) b.kin = kin;
    const box = cs.querySelector('Box'), sph = cs.querySelector('Sphere'), cyl = cs.querySelector('Cylinder');
    if (box) { const s = nums(box, 'size', [2, 2, 2]); xneed(s[2] === 1.2, 'X3D_2D_DEPTH', 'The exported Box bridge depth is 1.2; arbitrary Z depth is not simulated'); b.shape = 'box'; b.w = s[0]; b.h = s[1]; }
    else if (sph) { b.shape = 'ball'; b.r = xscalar(sph, 'radius', 1); }
    else if (cyl) { b.shape = 'pill'; b.r = xscalar(cyl, 'radius', 1); b.hl = xscalar(cyl, 'height', 2) / 2 - b.r; }
    else throw new Error('RigidBody "' + id + '": the shape must be a Box, a Sphere or a Cylinder.');
    if (![b.x, b.y, b.a, b.mass].every(isFinite)) throw new Error('RigidBody "' + id + '" has a number that does not parse.');
    L.bodies.push(b);
  }
  for (const j of rbc.querySelectorAll(':scope > SingleAxisHingeJoint, :scope > BallJoint')) {
    const m = readMeta(j, 'flop'), ap = nums(j, 'anchorPoint', [0, 0, 0]);
    xneed(ap[2] === 0, 'X3D_2D_FRAME', 'Joint anchors must have z=0');
    if (j.tagName === 'SingleAxisHingeJoint') { const axis = nums(j, 'axis', [0, 0, 1]); xneed(axis[0] === 0 && axis[1] === 0 && axis[2] === 1, 'X3D_2D_FRAME', 'Hinge axis must be 0 0 1'); }
    const ref = (cf) => { const e = j.querySelector(`RigidBody[containerField="${cf}"]`); return e ? e.getAttribute('USE') || e.getAttribute('DEF') : null; };
    const a = ref('body1'), b = ref('body2');
    if (!a || !ids.has(a) || (b && !ids.has(b))) throw new Error('Joint "' + j.getAttribute('DEF') + '" names a body that is not in the file.');
    const o = { id: j.getAttribute('DEF') || 'j' + L.joints.length, part: m.part || '', a, b, ax: ap[0], ay: ap[1], comp: m.comp ?? 0, damp: m.damp ?? 0 };
    if (j.tagName === 'SingleAxisHingeJoint') { o.type = 'hinge'; const has = j.hasAttribute('minAngle') || j.hasAttribute('maxAngle'); o.min = has ? xscalar(j, 'minAngle', -PI) : null; o.max = has ? xscalar(j, 'maxAngle', PI) : null; }
    else { o.type = m.type === 'rope' ? 'rope' : 'spring'; o.bx = m.bx ?? ap[0]; o.by = m.by ?? ap[1]; if (m.rest !== undefined) o.rest = m.rest; }
    L.joints.push(o);
  }
  for (const s of doc.querySelectorAll('ProximitySensor')) {
    const m = readMeta(s, 'flop'); delete m._first; if (!m.kind) continue;
    const c = nums(s, 'center', [0, 0, 0]), sz = nums(s, 'size', [1, 1, 1]);
    xneed(c[2] === 0 && sz[2] === 2, 'X3D_2D_DEPTH', 'Flop regions use z=0 and depth 2');
    L.zones.push(Object.assign(m, { id: s.getAttribute('DEF') || 'z' + L.zones.length, x: c[0], y: c[1], w: sz[0], h: sz[1], part: m.part || '' }));
  }
  if (!L.bodies.length) throw new Error('The RigidBodyCollection has no RigidBody children.');
  for (const b of L.bodies) if (b.group > 100) L.gseq = Math.max(L.gseq, b.group - 100);
  validateLevel(L);
  L.importReport = { profile: 'floplab-x3d-slice/1', scope: 'Local supported-slice checks, not XSD or a physics conformance verdict.', stats: getLevelStats(L),
    approximations: ['Cylinder display encodes a 2D sampled pill; it is not a 3D capsule dynamics claim.', 'BallJoint plus flop metadata encodes this solver\'s spring/rope model.', 'ProximitySensor plus flop metadata encodes game regions, not native browser sensor behavior.', 'Camera, navigation, background and material appearance are world-owned presentation; the runtime uses its own view and role palette.'] };
  return L;
}
