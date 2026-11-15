// Theatre.js project state (what studio.createContentsToExport() / the state.json writes) -> neutral timeline.
// @theatre/core (Apache-2.0) is the oracle: the curve maths are Theatre's own, nothing about handles is re-implemented here.
// @theatre/studio (AGPL-3.0) is NOT imported anywhere in this package: the state file is plain JSON an author's studio wrote.
import pkg from '@theatre/core';
import { bake } from './bake.js';
import { FIELD_TYPES, COMPONENTS, typeOf } from './model.js';
const { getProject, types } = pkg;

let counter = 0;
// object name in Theatre == DEF in the scene; prop paths are  field  or  field.component  (translation.x, diffuseColor.r, rotation.z, transparency)
export function restFromState(sheetState) {
  const rest = {}, cmp = (type) => COMPONENTS[type];
  for (const [obj, o] of Object.entries(sheetState.sequence.tracksByObject)) for (const path of Object.keys(o.trackIdByPropPath)) {
    const [field, comp] = JSON.parse(path); const type = typeOf(field); (rest[obj] ||= {});
    if (cmp(type) === null) { if (comp) throw new Error(`${obj}.${field} is a scalar but the track path has a component`); rest[obj][field] = 0; }
    else { if (!cmp(type).includes(comp)) throw new Error(`${obj}.${field}: component '${comp}' is not one of ${cmp(type)}`); (rest[obj][field] ||= Object.fromEntries(cmp(type).map((c) => [c, 0])))[comp] = 0; }
  }
  return rest;
}
const typesTree = (v) => (typeof v === 'number' ? types.number(v) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typesTree(x)])));
const clone = (v) => (typeof v === 'number' ? v : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])));

export async function fromTheatre(projectState, { sheet = 'Sheet1', name, fps = 60, tol = 1, defaults = {} } = {}) {
  const st = projectState.sheetsById[sheet]; if (!st || !st.sequence) throw new Error(`Theatre state has no sequence on sheet '${sheet}' (has: ${Object.keys(projectState.sheetsById)})`);
  const rest = restFromState(st);
  // props the author did not key keep the value a caller gives in `defaults` (e.g. a scale that is 1, not 0)
  for (const [d, fs] of Object.entries(defaults)) for (const [f, v] of Object.entries(fs)) if (rest[d] && rest[d][f] !== undefined) rest[d][f] = typeof v === 'number' ? v : { ...rest[d][f], ...v };
  const proj = getProject('x3d-anim-' + (++counter), { state: projectState }); await proj.ready;
  const sh = proj.sheet(sheet), objs = Object.fromEntries(Object.entries(rest).map(([d, p]) => [d, sh.object(d, typesTree(p))]));
  const must = []; for (const o of Object.values(st.sequence.tracksByObject)) for (const t of Object.values(o.trackData)) for (const k of t.keyframes) must.push(k.position);
  const evalAt = (t) => { sh.sequence.position = t; return Object.fromEntries(Object.entries(objs).map(([d, o]) => [d, clone(o.value)])); };
  const duration = st.sequence.length, res = bake(name || sheet, evalAt, rest, { duration, fps, must: [...new Set(must)].sort((a, b) => a - b), tol });
  return { ...res, source: { tool: 'Theatre.js', core: '@theatre/core', sheet, theatreKeyframes: new Set(must).size, tracks: Object.values(st.sequence.tracksByObject).reduce((n, o) => n + Object.keys(o.trackData).length, 0) }, oracle: evalAt };
}
