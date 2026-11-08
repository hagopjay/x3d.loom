/* Additive reader nodes for the Gobbler 3 scene. Concatenated after brain/reader.js in the same bundle scope, so DEFS, PARSE, FLAT, CONTAINER,
   events, receive and R are visible. Nothing here changes how the brain scenes parse: entries are only added, and `receive` is wrapped. */

// ColorRGBA, Normal and the 3D texture coordinates of the ribbon quads stay flat typed arrays: the deep build carries 100,000+ numbers in them
FLAT['TextureCoordinate3D.point'] = Float32Array; FLAT['ColorRGBA.color'] = Float32Array; FLAT['IndexedFaceSet.texCoordIndex'] = Int32Array; FLAT['IndexedFaceSet.colorIndex'] = Int32Array;
FLAT['VolumeEmitter.coordIndex'] = Int32Array;
PARSE.MFBool = (s) => String(s).replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean).map((t) => /^true$/i.test(t));
PARSE.MFPixel = (s) => String(s).replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean).map((t) => (/^0x/i.test(t) ? parseInt(t, 16) : parseInt(t, 10) || 0));

Object.assign(DEFS, {
  PointSet: { coord: ['SFNode', IO, null], color: ['SFNode', IO, null], attrib: ['MFNode', IO, []] },
  TextureCoordinate3D: { point: ['MFVec3f', IO, []] },
  PixelTexture: { image: ['MFPixel', INIT, [0, 0, 0]], repeatS: ['SFBool', INIT, true], repeatT: ['SFBool', INIT, true] },
  VolumeEmitter: { ...emitter, coordIndex: ['MFInt32', INIT, []], coord: ['SFNode', INIT, null], internal: ['SFBool', INIT, true] },
  BooleanFilter: { set_boolean: ['SFBool', IN, false], inputTrue: ['SFBool', OUT, false], inputFalse: ['SFBool', OUT, false], inputNegate: ['SFBool', OUT, false] },
  BooleanSequencer: { key: ['MFFloat', IO, []], keyValue: ['MFBool', IO, []], set_fraction: ['SFFloat', IN, 0], value_changed: ['SFBool', OUT, false], next: ['SFBool', IN, false], previous: ['SFBool', IN, false] },
});
// a Coordinate inside a VolumeEmitter is the emitter's own, and ColorRGBA inside a ParticleSystem is its colour ramp
Object.assign(CONTAINER, { PointSet: 'geometry', TextureCoordinate3D: 'texCoord', PixelTexture: 'texture', VolumeEmitter: 'emitter' });
DEFS.Appearance.alphaMode = ['SFString', IO, 'AUTO']; DEFS.Appearance.metadata = ['SFNode', IO, null];

/* Boolean event utilities (19775-1 chapter 31). Both are pure event nodes: a ROUTE into them runs here, their outputs leave through events.emit. */
const _receive = receive;
receive = function (node, field, value) {
  if (node.type === 'BooleanFilter' && field === 'set_boolean') {
    const v = !!value;
    if (v) { node.f.inputTrue = true; events.emit(node, 'inputTrue', true); } else { node.f.inputFalse = false; events.emit(node, 'inputFalse', false); }
    node.f.inputNegate = !v; events.emit(node, 'inputNegate', !v);
    return;
  }
  if (node.type === 'BooleanSequencer' && (field === 'set_fraction' || field === 'next' || field === 'previous')) {
    const k = node.f.key, kv = node.f.keyValue, N = Math.min(k.length, kv.length);
    if (!N) return;
    let i;
    if (field === 'set_fraction') { const fr = value; i = 0; if (fr >= k[N - 1]) i = N - 1; else if (fr > k[0]) { while (i < N - 1 && fr >= k[i + 1]) i++; } }
    else { const cur = node.state && node.state.i != null ? node.state.i : -1; i = field === 'next' ? (cur + 1) % N : (cur - 1 + N) % N; }
    node.state = node.state || {}; node.state.i = i;
    node.f.value_changed = kv[i]; events.emit(node, 'value_changed', kv[i]);
    return;
  }
  return _receive(node, field, value);
};
R.receive = receive;

Object.assign(DEFS.Shape, { bboxCenter: ['SFVec3f', INIT, [0, 0, 0]], bboxSize: ['SFVec3f', INIT, [-1, -1, -1]] });   // culling hints: the body does not use them
