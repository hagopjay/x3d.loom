/* DISEntityManager (DIS level 2): DISEntityManager notifies a scene when new DIS ESPDU entities arrive or current entities leave.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('DISEntityManager', {
  component: 'DIS', level: 2,
  container: 'children',
  defs: {
    addedEntities: ['MFNode', OUT, []],
    address: ['SFString', IO, "localhost"],
    applicationID: ['SFInt32', IO, 0],
    children: ['MFNode', IO, []],
    metadata: ['SFNode', IO, null],
    port: ['SFInt32', IO, 0],
    removedEntities: ['MFNode', OUT, []],
    siteID: ['SFInt32', IO, 0],
  },
  // X_ITE 16.6.0 marks the DIS component as not supported: the node holds its fields and its children; no socket is opened, addedEntities and removedEntities never fire, and it draws nothing (neither the children nor the node). The bridge copies that (no build).
});
