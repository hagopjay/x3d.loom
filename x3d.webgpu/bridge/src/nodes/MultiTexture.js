/* MultiTexture (Texturing level 2): MultiTexture applies several individual textures to a single geometry node, enabling a variety of visual effects that include light mapping and environment mapp
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('MultiTexture', {
  component: 'Texturing', level: 2,
  container: 'texture',
  defs: {
    alpha: ['SFFloat', IO, 1],
    color: ['SFColor', IO, [1, 1, 1]],
    description: ['SFString', IO, ""],
    function: ['MFString', IO, []],
    metadata: ['SFNode', IO, null],
    mode: ['MFString', IO, []],
    source: ['MFString', IO, []],
    texture: ['MFNode', IO, []],
  },
  // X3DTextureNode: several textures laid over each other. Combined on a canvas into one texture when the images have loaded (body-br): mode[i] says how texture i meets the result
  // so far (REPLACE, MODULATE, MODULATE2X, MODULATE4X, ADD; anything else is MODULATE with a note). function, source, color and alpha are read and not used (gap).
  changed(body, n, field) { const t = body.texCache.get(n.id); if (t && t.redraw) t.redraw(); },
});
