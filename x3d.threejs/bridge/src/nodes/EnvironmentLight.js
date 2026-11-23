/* EnvironmentLight for the three.js bridge (X3D 4.0, Lighting component): the image-based light. The specularTexture cube map (diffuseTexture when there is no specular one) becomes scene.environment,
   which three.js filters (PMREM) and the glTF-model MeshPhysicalMaterial lights with; intensity is scene.environmentIntensity. `on` FALSE removes it. The cube is six decoded images, one per face, linear (colour
   management is off in this body, as for every other colour). Found by the render oracle (x3d.render-oracle, 23 Nov 2026): without this node 21 of 29 conformance scenes drew black against X_ITE and x3d.wgpu.
   Not done: exp2_c_physical_default (PhysicalMaterial, headlight only, no EnvironmentLight): three.js 128 vs X_ITE 186 vs x3d.wgpu 188, while the same scene with headlight=false is black in all three, so the 186 comes from the headlight, not an environment (a default white environment at 0.5 was tried and broke the PhysicalMaterial fixture and the headlight=false controls: reverted); the diffuse and specular cubes are one cube here. */
R.bridge.three = R.bridge.three || { build: {}, geometry: {}, changed: {} };
(function () {
  const FACES = ['right', 'left', 'top', 'bottom', 'front', 'back'];
  function apply(body) {
    const n = body.envNode; if (!n) { body.scene.environment = null; return; }
    body.scene.environment = n.f.on === false ? null : body.envCube || null; body.scene.environmentIntensity = n.f.intensity == null ? 1 : n.f.intensity; body.dirty = true;
  }
  R.bridge.three.build.EnvironmentLight = function (body, n, parent) {
    const t = n.f.specularTexture || n.f.diffuseTexture; body.envNode = n; body.envCube = null; apply(body);
    if (!t || t.type !== 'ComposedCubeMapTexture') { if (t) body.note('EnvironmentLight: only a ComposedCubeMapTexture is drawn'); return null; }
    const gen = body.envGen = (body.envGen || 0) + 1, imgs = {}; let left = 6;
    for (const k of FACES) {
      const tn = t.f[k + 'Texture'], u = tn && tn.f.url && tn.f.url[0]; if (!u) { body.note('EnvironmentLight needs all six faces'); return null; }
      const im = new Image(); im.crossOrigin = 'anonymous'; imgs[k] = im;
      im.onload = () => { if (--left || gen !== body.envGen) return; const c = new THREE.CubeTexture(FACES.map((f) => imgs[f])); c.needsUpdate = true; if (body.envCube) body.envCube.dispose(); body.envCube = c; apply(body); };
      im.onerror = () => body.note('EnvironmentLight: a face did not load'); im.src = body.resolve(u, body.baseUrl);
    }
    return null;
  };
  R.bridge.three.changed.EnvironmentLight = function (body, n, field) { if (field === 'intensity' || field === 'on') apply(body); };
})();
