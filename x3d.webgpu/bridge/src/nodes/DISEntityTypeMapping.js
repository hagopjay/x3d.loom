/* DISEntityTypeMapping (DIS level 2): DISEntityTypeMapping provides a best-match mapping from DIS ESPDU entity type information to a specific X3D model, thus providing a visual and behavioral repres
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('DISEntityTypeMapping', {
  component: 'DIS', level: 2,
  container: 'children',
  defs: {
    autoRefresh: ['SFTime', IO, 0],
    autoRefreshTimeLimit: ['SFTime', IO, 3600],
    category: ['SFInt32', INIT, 0],
    country: ['SFInt32', INIT, 0],
    description: ['SFString', IO, ""],
    domain: ['SFInt32', INIT, 0],
    extra: ['SFInt32', INIT, 0],
    kind: ['SFInt32', INIT, 0],
    load: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    specific: ['SFInt32', INIT, 0],
    subcategory: ['SFInt32', INIT, 0],
    url: ['MFString', IO, []],
  },
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
