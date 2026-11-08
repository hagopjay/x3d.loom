/* AcousticProperties (Shape level 5): AcousticProperties specifies the interaction of sound waves with characteristics of geometric objects in the scene.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('AcousticProperties', {
  component: 'Shape', level: 5,
  container: 'acousticProperties',
  defs: {
    absorption: ['SFFloat', IO, 0],
    description: ['SFString', IO, ""],
    diffuse: ['SFFloat', IO, 0],
    enabled: ['SFBool', IO, true],
    metadata: ['SFNode', IO, null],
    refraction: ['SFFloat', IO, 0],
    specular: ['SFFloat', IO, 0],
  },
  extend: { Appearance: { acousticProperties: ['SFNode', IO, null] } },
  // Data for the sound side: nothing is drawn and the stock Sound node does not model reflection, so the values are held as given. BR.acoustics(appearance) hands them to a sound port:
  // { absorption, diffuse, specular, refraction } of the shape's AcousticProperties, or null when there is none or it is switched off (enabled false).
});
BR.acoustics = (appearance) => {
  const a = appearance && appearance.f && appearance.f.acousticProperties;
  return a && a.f.enabled !== false ? { absorption: a.f.absorption, diffuse: a.f.diffuse, specular: a.f.specular, refraction: a.f.refraction } : null;
};
