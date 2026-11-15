/* GeoMetadata (Geospatial level 1): GeoMetadata includes a generic subset of metadata about the geographic data.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('GeoMetadata', {
  component: 'Geospatial', level: 1,
  container: 'children',
  defs: {
    autoRefresh: ['SFTime', IO, 0],
    autoRefreshTimeLimit: ['SFTime', IO, 3600],
    data: ['MFNode', IO, []],
    description: ['SFString', IO, ""],
    load: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    summary: ['MFString', IO, []],
    url: ['MFString', IO, []],
  },
  // X_ITE 16.6.0: the node stores its fields and does nothing else. The url is never fetched (requestImmediateLoad is an empty function there: not at load, not after `load` or `url` change), `summary` is never
  // read, and the nodes in `data` are parsed and never drawn (a node DEFined in `data` can still be USEd elsewhere and drawn there). No build: the body ignores the node and does not walk its `data`.
});
