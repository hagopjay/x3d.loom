// Two looks for the same scene, switched at runtime through SAI (the exported file keeps the photoreal materials):
//  photoreal: PhysicalMaterial as authored + an image-based EnvironmentLight (X3D 4.1, added at runtime only, so exported files stay
//             X3D 4.0) lit by a procedural studio cubemap (six PixelTextures: no third-party images) + KHR PBR Neutral tone mapping
//  loom:      gold on dark (the Loom style): dark materials with gold emission, gold box outlines, glowing marble trails
import { BODY_STRIDE } from '../bridge/model.ts';
import { MATERIALS, TRAIL } from '../machine/index.ts';
import type { MachineIR } from '../machine/index.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SAI = any;
export type Look = 'photoreal' | 'loom';

const LOOM: Record<string, [number[], number[], number?]> = { // diffuse, emissive, transparency
  wood: [[0.04, 0.035, 0.03], [0.32, 0.22, 0.07]], brass: [[0.05, 0.04, 0.02], [0.75, 0.55, 0.18]], steel: [[0.04, 0.04, 0.05], [0.22, 0.2, 0.15]],
  red: [[0.05, 0.02, 0.02], [0.6, 0.3, 0.12]], blue: [[0.02, 0.03, 0.05], [0.25, 0.3, 0.45]], ivory: [[0.05, 0.05, 0.05], [0.55, 0.48, 0.32]],
  ebony: [[0.02, 0.02, 0.02], [0.12, 0.09, 0.04]], frame: [[0.02, 0.02, 0.02], [0.18, 0.13, 0.05]], pegboard: [[0.03, 0.03, 0.04], [0.1, 0.08, 0.04]],
  glassPane: [[0, 0, 0], [0, 0, 0], 1],
  marble0: [[0, 0, 0], [1, 0.82, 0.4]], marble1: [[0, 0, 0], [1, 0.7, 0.3]], marble2: [[0, 0, 0], [0.95, 0.88, 0.5]], marble3: [[0, 0, 0], [1, 0.76, 0.35]],
stone: [[0.04, 0.035, 0.03], [0.3, 0.24, 0.12]], stoneDark: [[0.03, 0.03, 0.03], [0.16, 0.12, 0.06]], grass: [[0.01, 0.015, 0.01], [0.03, 0.04, 0.02]],
  iron: [[0.03, 0.03, 0.03], [0.2, 0.17, 0.1]], rope: [[0.04, 0.03, 0.02], [0.5, 0.36, 0.14]], felt: [[0.01, 0.015, 0.012], [0.025, 0.03, 0.025]],
  bead: [[0, 0, 0], [1, 0.84, 0.45]], domino0: [[0, 0, 0], [0.9, 0.5, 0.18]], domino1: [[0, 0, 0], [1, 0.78, 0.35]], domino2: [[0, 0, 0], [0.8, 0.62, 0.25]],
  domino3: [[0, 0, 0], [0.7, 0.55, 0.3]], domino4: [[0, 0, 0], [0.95, 0.88, 0.62]],
  carpet: [[0.02, 0.01, 0.01], [0.35, 0.12, 0.08]], cardboard: [[0.03, 0.02, 0.01], [0.45, 0.33, 0.15]], rail: [[0.02, 0.02, 0.02], [0.6, 0.5, 0.3]], tnt: [[0.03, 0, 0], [0.9, 0.25, 0.1]], roof: [[0.03, 0.01, 0.01], [0.6, 0.22, 0.1]], banner: [[0.01, 0.01, 0.03], [0.3, 0.35, 0.6]], gold: [[0, 0, 0], [1, 0.8, 0.35]], dummyBall: [[0, 0, 0], [1, 0.8, 0.3]], stoneWarm: [[0.04, 0.035, 0.03], [0.35, 0.28, 0.14]],
    bar0: [[0, 0, 0], [0.9, 0.55, 0.2]], bar1: [[0, 0, 0], [0.9, 0.62, 0.22]], bar2: [[0, 0, 0], [0.92, 0.7, 0.26]], bar3: [[0, 0, 0], [0.92, 0.78, 0.3]], bar4: [[0, 0, 0], [0.95, 0.85, 0.36]],
};

export class Looks {
  look: Look = 'photoreal';
  private readonly X3D: SAI;
  private readonly browser: SAI;
  private readonly scene: SAI;
  private readonly apps = new Map<string, { app: SAI; original: SAI; loom: SAI }>();
  private readonly outlines: SAI[] = [];
  private readonly trails: { coord: SAI; body: number; pts: number[][] }[] = [];
  private env: SAI = null;
  private readonly lights: { node: SAI; intensity: number }[] = [];

  constructor(X3D: SAI, browser: SAI, scene: SAI, ir: MachineIR) {
    this.X3D = X3D; this.browser = browser; this.scene = scene;
    const get = (d: string) => { try { return scene.getNamedNode(d); } catch { return null; } };
    for (const k of Object.keys(MATERIALS)) {
      const app = get(`Mat_${k}`); if (!app) continue;
      const [dif, em, tr] = LOOM[k] ?? LOOM.steel;
      const m = scene.createNode('Material');
      m.diffuseColor = new X3D.SFColor(...dif); m.emissiveColor = new X3D.SFColor(...em); m.specularColor = new X3D.SFColor(0, 0, 0);
      if (tr) m.transparency = tr;
      this.apps.set(k, { app, original: app.material, loom: m });
    }
    for (const b of ir.bodies) for (const s of b.shapes) { const o = get(`${s.def}O`); if (o) this.outlines.push(o); }
    ir.bodies.forEach((b, i) => { if (b.role === 'marble') { const c = get(`${b.def}Trail`); if (c) this.trails.push({ coord: c, body: i, pts: [] }); } });
    for (const d of ['Key', 'Fill', 'Rim']) { const l = get(d); if (l) this.lights.push({ node: l, intensity: l.intensity }); }
  }

  /** A procedural studio environment: six small faces, bright above, warm walls, dark floor. */
  private environment(): SAI {
    if (this.env) return this.env;
    const X3D = this.X3D, sc = this.scene, N = 8;
    const face = (top: number[], bottom: number[]) => {
      const t = sc.createNode('PixelTexture'), px: number[] = [];
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const a = j / (N - 1), c = top.map((v, k) => v * a + bottom[k] * (1 - a));
        const softbox = Math.abs(i - N / 2 + 0.5) < 2 && j > N - 3 ? 1.6 : 1; // a soft light near the top of each wall
        px.push((Math.min(255, Math.round(c[0] * 255 * softbox)) << 16) | (Math.min(255, Math.round(c[1] * 255 * softbox)) << 8) | Math.min(255, Math.round(c[2] * 255 * softbox)));
      }
      t.image = new X3D.SFImage(N, N, 3, new X3D.MFInt32(...px));
      return t;
    };
    const cube = sc.createNode('ComposedCubeMapTexture');
    const wall = () => face([0.85, 0.82, 0.76], [0.28, 0.22, 0.17]);
    cube.frontTexture = wall(); cube.backTexture = wall(); cube.leftTexture = wall(); cube.rightTexture = wall();
    cube.topTexture = face([1, 0.98, 0.94], [1, 0.98, 0.94]); cube.bottomTexture = face([0.12, 0.1, 0.08], [0.12, 0.1, 0.08]);
    const env = sc.createNode('EnvironmentLight');
    env.specularTexture = cube; env.diffuseTexture = cube; env.intensity = 0.9;
    sc.addRootNode(env);
    return (this.env = env);
  }

  /** The cube map lives in X3D's CubeMapTexturing component, which X_ITE loads on demand (SAI loadComponents). */
  async prepare() { await this.browser.loadComponents(this.browser.getComponent('CubeMapTexturing', 1)); }

  apply(look: Look) {
    this.look = look;
    const loom = look === 'loom';
    try { const env = this.environment(); env.on = !loom; } catch (e) { console.warn('EnvironmentLight unavailable', e); }
    this.browser.setBrowserOption('ToneMapping', loom ? 'NONE' : 'KHR_PBR_NEUTRAL');
    try { this.scene.getNamedNode('Sky').skyColor = new this.X3D.MFColor(loom ? new this.X3D.SFColor(0.012, 0.012, 0.02) : new this.X3D.SFColor(0.05, 0.06, 0.08)); } catch { /* no Sky */ }
    for (const [k, a] of this.apps) {
      a.app.material = loom ? a.loom : a.original;
      if (k === 'pegboard') a.app.texture = loom ? a.original.baseTexture : null; // keep the holes, faintly, in the dark look
    }
    for (const o of this.outlines) o.whichChoice = loom ? 0 : -1;
    for (const l of this.lights) l.node.intensity = loom ? l.intensity * 0.25 : l.intensity;
    try { this.scene.getNamedNode('Trails').whichChoice = loom ? 0 : -1; } catch { /* no trails */ }
    if (!loom) for (const t of this.trails) t.pts = [];
  }

  /** Glowing trails: the last TRAIL positions of each marble (Loom look only). */
  updateTrails(state: Float64Array | null) {
    if (this.look !== 'loom' || !state) return;
    const X3D = this.X3D;
    for (const t of this.trails) {
      const o = t.body * BODY_STRIDE, p = [state[o], state[o + 1], state[o + 2] + 0.001];
      const last = t.pts[t.pts.length - 1];
      if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.002) continue;
      if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.1) t.pts = []; // a teleport (drop, reset): start a new trail
      t.pts.push(p); if (t.pts.length > TRAIL) t.pts.shift();
      const pts = Array.from({ length: TRAIL }, (_, i) => t.pts[Math.max(0, i - (TRAIL - t.pts.length))] ?? p);
      t.coord.point = new X3D.MFVec3f(...pts.map((q) => new X3D.SFVec3f(q[0], q[1], q[2])));
    }
  }
}
