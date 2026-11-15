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
  // receive(n, field, value): return true when the event is handled here
  // tick(n, now): once per timestamp, before the event queue drains
  // build(body, n, parent, chain): a drawn node
});
