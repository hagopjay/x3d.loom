/* Layer (Layering level 1): Layer contains a list of children nodes that define the contents of the layer.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('Layer', {
  component: 'Layering', level: 1,
  container: 'layers',
  defs: {
    addChildren: ['MFNode', IN, []],
    children: ['MFNode', IO, []],
    metadata: ['SFNode', IO, null],
    objectType: ['MFString', IO, ['ALL']],
    pickable: ['SFBool', IO, true],
    pointerEvents: ['SFBool', IO, true],        // X_ITE 16.6.0 has it; the 4.0 UOM calls the pair pickable / objectType
    removeChildren: ['MFNode', IN, []],
    viewport: ['SFNode', IO, null],
    visible: ['SFBool', IO, true],
  },
  /* A layer is drawn by its LayerSet (LayerSet.js): its children are built under a node of their own, seen by a camera of their own (the layer's first Viewpoint, or one at 0 0 10 looking down -z),
     on top of the layers before it. visible = FALSE takes it out of the draw order. addChildren and removeChildren change the list. pickable, objectType, pointerEvents and viewport are held. */
  receive(n, field, v) {
    if (field !== 'addChildren' && field !== 'removeChildren') return false;
    const cur = n.f.children || [], list = [...v];
    n.f.children = field === 'addChildren' ? cur.concat(list.filter((x) => !cur.includes(x))) : cur.filter((x) => !list.includes(x));
    events.emit(n, 'children', n.f.children);
    if (R.bridge.body) R.bridge.body.changed(n, 'children');
    return true;
  },
  changed(body, n, field) { BR.layers.layerChanged(body, n, field); },
});
