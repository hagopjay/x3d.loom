// X3D 4.0 wrapper for the X_ITE engine: an Inline of the glb plus a Viewpoint computed from the shared camera.

/** Right-handed look-at -> X3D axis-angle orientation (rotation from the default view: looking down -Z, +Y up). */
export function orientationFromLookAt(position, target, up = [0, 1, 0]) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (v) => {
    const l = Math.hypot(...v) || 1;
    return v.map((x) => x / l);
  };
  const f = norm(sub(target, position)); // forward
  const r = norm(cross(f, up)); // right
  const u = cross(r, f); // true up
  // columns of the camera-to-world rotation: right, up, -forward
  const m = [
    [r[0], u[0], -f[0]],
    [r[1], u[1], -f[1]],
    [r[2], u[2], -f[2]],
  ];
  const trace = m[0][0] + m[1][1] + m[2][2];
  const cosA = Math.max(-1, Math.min(1, (trace - 1) / 2));
  const angle = Math.acos(cosA);
  if (angle < 1e-9) return [0, 1, 0, 0];
  let axis;
  if (Math.PI - angle < 1e-6) {
    // 180 degrees: axis from the diagonal
    const xx = Math.sqrt(Math.max(0, (m[0][0] + 1) / 2));
    const yy = Math.sqrt(Math.max(0, (m[1][1] + 1) / 2));
    const zz = Math.sqrt(Math.max(0, (m[2][2] + 1) / 2));
    axis = [xx, m[0][1] + m[1][0] >= 0 ? yy : -yy, m[0][2] + m[2][0] >= 0 ? zz : -zz];
  } else {
    axis = norm([m[2][1] - m[1][2], m[0][2] - m[2][0], m[1][0] - m[0][1]]);
  }
  return [...axis, angle];
}

const f = (n) => Number(n.toPrecision(9)).toString();

/**
 * @param camera   {position,target,up,fov,near,far}
 * @param opts     {headlight:boolean, bg:[r,g,b] (0..1, as written to skyColor), glbUrl,
 *                  ambient: null | {intensity, dataUri}  weak uniform ambient as an EnvironmentLight whose
 *                  diffuse cube map is six copies of a 1x1 grey PNG (PhysicalMaterial has no other ambient term)}
 */
export function buildWrapper(camera, { headlight, bg, glbUrl = 'model.glb', ambient = null }) {
  const o = orientationFromLookAt(camera.position, camera.target, camera.up);
  const dist = Math.hypot(...camera.position.map((p, i) => p - camera.target[i]));
  // Viewpoint.nearDistance/farDistance carry the shared clip planes; avatarSize/visibilityLimit are set consistently as well.
  const avatarR = Math.max(camera.near * 2, 1e-6);
  return `<?xml version="1.0" encoding="UTF-8"?>
<X3D profile='Full' version='4.0'>
  <head>
    <meta name='generator' content='x3d.gltf render oracle'/>
  </head>
  <Scene>
    <NavigationInfo type='"NONE"' headlight='${headlight ? 'true' : 'false'}' avatarSize='${f(avatarR)} 1.6 0.75' visibilityLimit='${f(camera.far)}'/>
    <Viewpoint description='shared camera' position='${camera.position.map(f).join(' ')}' orientation='${o.map(f).join(' ')}' fieldOfView='${f(camera.fov)}' nearDistance='${f(camera.near)}' farDistance='${f(camera.far)}'/>
    <Background skyColor='${bg.map(f).join(' ')}'/>
${ambient ? `    <EnvironmentLight DEF='AMBIENT' intensity='${f(ambient.intensity)}' global='true'>
      <ComposedCubeMapTexture containerField='diffuseTexture'>
        <ImageTexture DEF='AMB_FACE' containerField='frontTexture' url='"${ambient.dataUri}"'/>
        <ImageTexture USE='AMB_FACE' containerField='backTexture'/>
        <ImageTexture USE='AMB_FACE' containerField='leftTexture'/>
        <ImageTexture USE='AMB_FACE' containerField='rightTexture'/>
        <ImageTexture USE='AMB_FACE' containerField='topTexture'/>
        <ImageTexture USE='AMB_FACE' containerField='bottomTexture'/>
      </ComposedCubeMapTexture>
    </EnvironmentLight>
` : ''}    <Inline DEF='GLB' url='"${glbUrl}"'/>
    <LoadSensor DEF='LOADED' timeOut='0'>
      <Inline USE='GLB'/>
    </LoadSensor>
  </Scene>
</X3D>
`;
}
