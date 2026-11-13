/* GeneratedCubeMapTexture (CubeMapTexturing level 3): GeneratedCubeMapTexture is a texture node that defines a cubic environment map that sources its data from internally generated images.
   Field table generated from X3DUOM 4.0 by driver.py scaffold; the behaviour below is hand written. */
BR.node('GeneratedCubeMapTexture', {
  component: 'CubeMapTexturing', level: 3,
  container: 'texture',
  defs: {
    description: ['SFString', IO, ""],
    metadata: ['SFNode', IO, null],
    size: ['SFInt32', INIT, 128],
    textureProperties: ['SFNode', INIT, null],
    update: ['SFString', IO, "NONE"],
  },
  /* The six faces are drawn by a Babylon ReflectionProbe at the origin of the Shape that uses the texture, looking along the six axes, with the Shape itself left out. update NONE: no picture is
     taken (black, transparent); NEXT_FRAME_ONLY: one picture on the next frame, then update goes back to NONE (an event, as in X_ITE); ALWAYS: a picture every frame. size is the edge of a face
     in pixels. Gap: the faces of the cube are not turned like X_ITE's (flat colours cannot show it), the probe sees the Background spheres only if they are in the world. */
  build() { return null; },
  changed(body, n, field) { if (field === 'update') BR.cube.generatedUpdate(body, n); },
});
BR.cube ||= {};                                        // this file loads before ImageCubeMapTexture.js, which adds the rest
Object.assign(BR.cube, {
  generated(body, mat, node, mesh) {
    const key = 'cube:' + node.id; let e = body.texCache.get(key);
    if (!e) {
      const size = node.f.size > 0 ? node.f.size : 128;
      const probe = new BABYLON.ReflectionProbe('gcm-' + node.id, size, body.scene, false);
      probe.cubeTexture.coordinatesMode = BABYLON.Texture.CUBIC_MODE; probe.cubeTexture.clearColor = new BABYLON.Color4(0, 0, 0, 0);
      const flipY = BABYLON.Matrix.Scaling(1, -1, 1); probe.cubeTexture.getReflectionTextureMatrix = () => flipY;   // the render-target faces come out upside down on WebGPU: the top face is read as the bottom one
      probe.attachToMesh(mesh);
      e = { tex: probe.cubeTexture, probe, mats: [], node, mesh }; body.texCache.set(key, e);
      (body._gcm ||= new Set()).add(e);
      BR.cube.generatedUpdate(body, node);
    }
    e.mats.push(mat); mat.reflectionTexture = e.tex;
  },
  generatedUpdate(body, node) {
    const e = body.texCache.get('cube:' + node.id); if (!e || !e.probe) return;
    const upd = String(node.f.update || 'NONE'), rtt = e.tex, mine = new Set([e.mesh]); for (const m of e.mats) for (const x of body.scene.meshes) if (x.material === m) mine.add(x);
    const list = () => body.scene.meshes.filter((m) => !mine.has(m) && !(m.material && m.material.reflectionTexture && m.material.reflectionTexture.isRenderTarget));
    if (upd === 'NONE') { e.probe.renderList.length = 0; rtt.refreshRate = BABYLON.RenderTargetTexture.REFRESHRATE_RENDER_ONCE; rtt.resetRefreshCounter(); return; }
    e.probe.renderList.length = 0; for (const m of list()) e.probe.renderList.push(m);
    if (upd === 'ALWAYS') rtt.refreshRate = BABYLON.RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME;
    else {                                            // NEXT_FRAME_ONLY (and anything else): one picture, then back to NONE
      rtt.refreshRate = BABYLON.RenderTargetTexture.REFRESHRATE_RENDER_ONCE; rtt.resetRefreshCounter();
      const ob = rtt.onAfterRenderObservable.addOnce(() => { node.f.update = 'NONE'; events.emit(node, 'update', 'NONE'); });
    }
  },
  generatedFrame(body) {                              // the list of what the probes draw follows the world while a probe takes pictures
    if (!body._gcm) return;
    for (const e of body._gcm) {
      if (String(e.node.f.update) !== 'ALWAYS' || e.probe.cubeTexture.isDisposed?.()) continue;
      const mine = new Set([e.mesh]); for (const m of e.mats) for (const x of body.scene.meshes) if (x.material === m) mine.add(x);
      const rl = e.probe.renderList; rl.length = 0;
      for (const m of body.scene.meshes) if (!mine.has(m) && !(m.material && m.material.reflectionTexture && m.material.reflectionTexture.isRenderTarget)) rl.push(m);
    }
  },
});
