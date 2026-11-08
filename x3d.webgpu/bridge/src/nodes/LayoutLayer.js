/* LayoutLayer (Layout level 1): LayoutLayer is a Grouping node that can contain most nodes.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('LayoutLayer', {
  component: 'Layout', level: 1,
  container: 'layers',
  defs: {
    addChildren: ['MFNode', IN, []],
    children: ['MFNode', IO, []],
    layout: ['SFNode', IO, null],
    metadata: ['SFNode', IO, null],
    objectType: ['MFString', IO, ['ALL']],
    pickable: ['SFBool', IO, true],
    pointerEvents: ['SFBool', IO, true],        // X_ITE 16.6.0 has it
    removeChildren: ['MFNode', IN, []],
    viewport: ['SFNode', IO, null],
    visible: ['SFBool', IO, true],
  },
  /* A LayoutLayer is a Layer (LayerSet.js) that looks through an orthographic camera of its own (an OrthoViewpoint at 0 0 10, field of view -1 -1 1 1, so the canvas is 2 units high) and holds its
     children in an implicit LayoutGroup that uses the layer's layout (LayoutGroup.js). The viewport clips it like it does a Layer. pickable, objectType and pointerEvents are held. */
  receive(n, field, v) { return BR.addRemove(n, field, v); },
  changed(body, n, field) { BR.layers.layerChanged(body, n, field); },
});
