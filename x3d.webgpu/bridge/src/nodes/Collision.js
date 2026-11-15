/* Collision (Navigation level 2): a Group that tells the browser whether the viewer may pass through its children. The hall port gave it the fields (the same as Group plus enabled and proxy).
   The bridge draws it as a Group, the proxy is never drawn, and navigation never collides here, so isActive and collideTime stay silent (X_ITE 16.6.0 raises them only when its navigation hits the group). */
BR.node('Collision', {
  component: 'Navigation', level: 2,
  container: 'children',
  build(body, n, parent, chain) { return body.buildGroup(n, parent, chain); },
  changed(body, n, field) { const r = body.rec.get(n.id); if (!r) return; if (field === 'children') body.rebuildGroup(n); else if (field === 'visible') r.tn.setEnabled(n.f.visible !== false); },
});
