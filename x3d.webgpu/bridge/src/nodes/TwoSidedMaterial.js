/* TwoSidedMaterial (Shape level 4): TwoSidedMaterial specifies surface rendering properties for associated geometry nodes, for outer (front) and inner (back) sides of polygons.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('TwoSidedMaterial', {
  component: 'Shape', level: 4,
  container: 'material',
  defs: {
    ambientIntensity: ['SFFloat', IO, 0.2],
    backAmbientIntensity: ['SFFloat', IO, 0.2],
    backDiffuseColor: ['SFColor', IO, [0.8, 0.8, 0.8]],
    backEmissiveColor: ['SFColor', IO, [0, 0, 0]],
    backShininess: ['SFFloat', IO, 0.2],
    backSpecularColor: ['SFColor', IO, [0, 0, 0]],
    backTransparency: ['SFFloat', IO, 0],
    diffuseColor: ['SFColor', IO, [0.8, 0.8, 0.8]],
    emissiveColor: ['SFColor', IO, [0, 0, 0]],
    metadata: ['SFNode', IO, null],
    separateBackColor: ['SFBool', IO, false],
    shininess: ['SFFloat', IO, 0.2],
    specularColor: ['SFColor', IO, [0, 0, 0]],
    transparency: ['SFFloat', IO, 0],
  },
  // X3DMaterialNode: a front Material and a back Material (back* fields, or the front values when separateBackColor is false). Drawn as two passes of the same geometry,
  // front faces with the front colours, back faces with the back ones (body-br materialsFor / makeMaterial). Specular and shininess are read and not shown, as for Material here.
  changed(body, n) { for (const r of body.rec.values()) if (r.node && r.node.type === 'Shape' && r.node.f.appearance && r.node.f.appearance.f.material === n && r.tn) body.rebuildShapeIn(r); },
});
