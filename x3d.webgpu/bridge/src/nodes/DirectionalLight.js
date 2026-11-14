/* DirectionalLight (Lighting level 1): parallel light. The stock body made one Babylon DirectionalLight in world space for every DirectionalLight and ignored where it sat in the tree. Here it is a Babylon
   light under the TransformNode of its parent (as PointLight and SpotLight, see PointLight.js for BR.light), so the direction is in the coordinate system of the parent group as 19775-1 section 17.4.1 says
   and a Transform above it turns the light. global = FALSE lights only the meshes below the parent group. color, intensity and on follow the fields; ambientIntensity is not used (no ambient term).
   A page that sets opts.lightScale still scales the intensity, as for the stock light. */
BR.node('DirectionalLight', {
  component: 'Lighting', level: 1,
  build(body, n, parent) { BR.light.make(body, n, parent); return null; },
  changed(body, n, field) { if (n._light) { BR.light.refresh(n._light, n); if (field === 'global') BR.light.scope(body); } },
});
