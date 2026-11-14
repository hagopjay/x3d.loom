/* TextureProjectorParallel (TextureProjection level 2): the orthographic projector. Same node as TextureProjector (see TextureProjector.js for how it is drawn and for the X_ITE 16.6.0 rules);
   fieldOfView is the box (minimumX minimumY maximumX maximumY) in the projector's own units, widened to the picture's aspect ratio as X_ITE does, so the picture is never squeezed;
   the default is -1 -1 1 1. */
BR.node('TextureProjectorParallel', {
  component: 'TextureProjection', level: 2,
  container: 'children',
  defs: {
    ambientIntensity: ['SFFloat', IO, 0],
    aspectRatio: ['SFFloat', OUT, 0],
    color: ['SFColor', IO, [1, 1, 1]],
    description: ['SFString', IO, ""],
    direction: ['SFVec3f', IO, [0, 0, 1]],
    farDistance: ['SFFloat', IO, -1],
    fieldOfView: ['SFVec4f', IO, [-1, -1, 1, 1]],
    global: ['SFBool', IO, true],
    intensity: ['SFFloat', IO, 1],
    location: ['SFVec3f', IO, [0, 0, 0]],
    metadata: ['SFNode', IO, null],
    nearDistance: ['SFFloat', IO, -1],
    on: ['SFBool', IO, true],
    shadowIntensity: ['SFFloat', IO, 1],
    shadows: ['SFBool', IO, false],
    texture: ['SFNode', IO, null],
    upVector: ['SFVec3f', IO, [0, 1, 0]],
  },
  build(body, n, parent) { BR.proj.add(body, n, parent); return null; },
  changed(body, n, field) { if (field === 'texture') BR.proj.aspect(body, n); },
  dispose(body, n) { BR.proj.remove(body, n); },
});
