/* Layout (Layout level 1): Layout node is used as layout field of LayoutLayer and LayoutGroup nodes.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('Layout', {
  component: 'Layout', level: 1,
  container: 'layout',
  defs: {
    align: ['MFString', IO, ['CENTER', 'CENTER']],              // defaults as in X_ITE 16.6.0 (the 4.0 UOM lists none)
    metadata: ['SFNode', IO, null],
    offset: ['MFFloat', IO, [0, 0]],
    offsetUnits: ['MFString', IO, ['WORLD', 'WORLD']],
    scaleMode: ['MFString', IO, ['NONE', 'NONE']],
    size: ['MFFloat', IO, [1, 1]],
    sizeUnits: ['MFString', IO, ['WORLD', 'WORLD']],
  },
  /* A Layout draws nothing; the LayoutGroup or LayoutLayer that holds it reads its fields every frame (LayoutGroup.js, BR.layout), so a change shows on the next frame. */
  build() { return null; },
});
