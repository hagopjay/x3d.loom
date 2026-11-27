/* DIS for the three.js bridge. X_ITE 16.6.0 marks the component as not supported: an EspduTransform is a plain group whose translation, rotation, scale, center and scaleOrientation are held and
   never applied, no socket is opened and no output fires (x3d.webgpu/bridge/src/nodes/EspduTransform.js has the reading). The body draws it as that group; `visible` hides the subtree and a
   change of children is the body's own group rebuild. DISEntityManager, the three Pdu nodes and DISEntityTypeMapping hold fields and draw nothing, so they need no body code. */
R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
R.bridge.three.build.EspduTransform = (body, n, parent, chain) => { const r = body.buildGroup(n, parent, chain); if (r && r.tn) r.tn.visible = n.f.visible !== false; return r; };
R.bridge.three.changed.EspduTransform = (body, n, field) => { const r = body.rec.get(n.id); if (r && r.tn && field === 'visible') r.tn.visible = n.f.visible !== false; };
