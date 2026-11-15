/* LocalFog for the three.js bridge: the node is a child of a group and fogs that group's geometry; the body (fogFor, hookFog in body-three.js) picks the fog of each mesh as it is drawn. The record is the group object. */
R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
R.bridge.three.build.LocalFog = (body, n, parent) => { const l = body.fogScopes.get(parent) || []; l.push(n); body.fogScopes.set(parent, l); body.fogHooks = true; return null; };
