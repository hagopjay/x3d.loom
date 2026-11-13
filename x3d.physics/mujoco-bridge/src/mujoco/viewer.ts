import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export interface ViewOpts {
  contacts: boolean;
  jointAxes: boolean;
  sites: boolean;
  grid: boolean;
}

const MAX_CONTACTS = 512;

/**
 * Minimal three.js renderer for a MuJoCo model.
 * Geometry is built once per model from `model.geom_*`; per-frame transforms
 * come straight from `data.geom_xpos` / `data.geom_xmat` (stable typed-array
 * views, so no WASM handle juggling).
 */
export class Viewer3D {
  private container: HTMLElement;
  private frameRadius = 1;
  unsupported: string[] = [];
  private targetMarker = new THREE.Mesh(new THREE.SphereGeometry(0.027,16,12),new THREE.MeshBasicMaterial({color:0x67e8f9,transparent:true,opacity:0.8}));
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private geomGroup = new THREE.Group();
  private geomMeshes: THREE.Mesh[] = [];
  private siteGroup = new THREE.Group();
  private siteMeshes: THREE.Mesh[] = [];
  private contactMesh: THREE.InstancedMesh;
  private jointLines: THREE.LineSegments;
  private grid: THREE.GridHelper;
  private meshCache = new Map<number, THREE.BufferGeometry>();
  private tmpM = new THREE.Matrix4();
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0f1e);
    this.scene.fog = new THREE.Fog(0x0a0f1e, 20, 46);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.01, 300);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(3.4, -3.6, 2.5);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0.8);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxDistance = 60;
    this.controls.minDistance = 0.05;

    const hemisphere = new THREE.HemisphereLight(0xc7d8f5, 0x131c2e, 1.0);
    hemisphere.position.set(0, 0, 1);
    this.scene.add(hemisphere);
    const dir = new THREE.DirectionalLight(0xffffff, 2.4);
    dir.position.set(4.5, -5.5, 8);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    const c = dir.shadow.camera;
    c.left = -7;
    c.right = 7;
    c.top = 7;
    c.bottom = -7;
    c.far = 40;
    dir.shadow.bias = -0.0004;
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0x93c5fd, 0.5);
    fill.position.set(-5, 3, -4);
    this.scene.add(fill);

    this.grid = new THREE.GridHelper(28, 56, 0x33415e, 0x182136);
    this.grid.rotation.x = Math.PI / 2;
    this.grid.position.z = 0.001;
    this.scene.add(this.grid);
    this.scene.add(this.targetMarker);
    this.scene.add(this.geomGroup);
    this.scene.add(this.siteGroup);

    this.contactMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.022, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xf43f5e }),
      MAX_CONTACTS,
    );
    this.contactMesh.count = 0;
    this.contactMesh.frustumCulled = false;
    this.scene.add(this.contactMesh);

    this.jointLines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x4ade80 }),
    );
    this.jointLines.frustumCulled = false;
    this.jointLines.visible = false;
    this.scene.add(this.jointLines);

    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
  }

  resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setQuality(value: string): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, value === 'high' ? 2 : value === 'low' ? 1 : 1.5));
    this.renderer.shadowMap.enabled = value !== 'low';
    this.resize();
  }

  stats() { return { calls:this.renderer.info.render.calls, triangles:this.renderer.info.render.triangles, geometries:this.renderer.info.memory.geometries, textures:this.renderer.info.memory.textures }; }

  setView(name: string): void {
    const offset = name === 'top' ? new THREE.Vector3(0.001,-0.001,1) : name === 'front' ? new THREE.Vector3(0,-1,0.12) : name === 'side' ? new THREE.Vector3(1,0,0.12) : new THREE.Vector3(1,-1.35,0.9);
    const distance=this.frameRadius/Math.sin(this.camera.fov*Math.PI/360)*1.25;
    this.camera.position.copy(this.controls.target).add(offset.normalize().multiplyScalar(distance));
    this.controls.update();
  }

  frameModel(engine: any): void {
    this.sync(engine,{contacts:false,jointAxes:false,sites:false,grid:true});
    this.scene.updateMatrixWorld(true);
    const bounds=new THREE.Box3();
    for(let i=0;i<this.geomMeshes.length;i++) {
      if(engine.model.geom_type[i]===engine.mujoco.mjtGeom.mjGEOM_PLANE.value) continue;
      bounds.union(new THREE.Box3().setFromObject(this.geomMeshes[i]));
    }
    if(bounds.isEmpty()) bounds.setFromCenterAndSize(new THREE.Vector3(0,0,0.5),new THREE.Vector3(1,1,1));
    this.controls.target.copy(bounds.getCenter(new THREE.Vector3()));
    this.frameRadius=Math.max(0.3,bounds.getBoundingSphere(new THREE.Sphere()).radius);
    this.setView('iso');
  }

  private geomGeometry(engine: any, gi: number): THREE.BufferGeometry {
    const m = engine.model;
    const mj = engine.mujoco;
    const G = mj.mjtGeom;
    const type = m.geom_type[gi] as number;
    const size = m.geom_size;
    const o = gi * 3;
    if (type === G.mjGEOM_PLANE.value) {
      const sx = (size[o] as number) > 0 ? (size[o] as number) : 6;
      const sy = (size[o + 1] as number) > 0 ? (size[o + 1] as number) : 6;
      return new THREE.PlaneGeometry(sx * 2, sy * 2);
    }
    if (type === G.mjGEOM_SPHERE.value) return new THREE.SphereGeometry((size[o] as number) || 0.05, 28, 20);
    if (type === G.mjGEOM_CAPSULE.value) {
      const g = new THREE.CapsuleGeometry((size[o] as number) || 0.03, 2 * ((size[o + 1] as number) || 0.1), 8, 20);
      g.rotateX(Math.PI / 2); // three capsules lie along Y; MuJoCo along Z
      return g;
    }
    if (type === G.mjGEOM_CYLINDER.value) {
      const r = (size[o] as number) || 0.03;
      const g = new THREE.CylinderGeometry(r, r, 2 * ((size[o + 1] as number) || 0.1), 24);
      g.rotateX(Math.PI / 2);
      return g;
    }
    if (type === G.mjGEOM_ELLIPSOID.value) return new THREE.SphereGeometry(1, 24, 18);
    if (type === G.mjGEOM_BOX.value) {
      return new THREE.BoxGeometry(
        2 * ((size[o] as number) || 0.05),
        2 * ((size[o + 1] as number) || 0.05),
        2 * ((size[o + 2] as number) || 0.05),
      );
    }
    if (type === G.mjGEOM_MESH.value) {
      const dataid = m.geom_dataid[gi] as number;
      let g = this.meshCache.get(dataid);
      if (!g) {
        g = new THREE.BufferGeometry();
        try {
          const adr = (m.mesh_vertadr[dataid] as number) * 3;
          const num = (m.mesh_vertnum[dataid] as number) * 3;
          const mv = m.mesh_vert as ArrayLike<number>;
          const verts = new Float32Array(num);
          for (let i = 0; i < num; i++) verts[i] = mv[adr + i];
          g.setAttribute("position", new THREE.BufferAttribute(verts, 3));
          const fadr = (m.mesh_faceadr[dataid] as number) * 3;
          const fnum = (m.mesh_facenum[dataid] as number) * 3;
          const mf = m.mesh_face as ArrayLike<number>;
          const faces = new Uint32Array(fnum);
          for (let i = 0; i < fnum; i++) faces[i] = mf[fadr + i];
          g.setIndex(new THREE.BufferAttribute(faces, 1));
          g.computeVertexNormals();
        } catch {
          g.setAttribute(
            "position",
            new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0.1, 0, 0, 0, 0.1, 0]), 3),
          );
        }
        this.meshCache.set(dataid, g);
      }
      return g;
    }
    this.unsupported.push(`geom ${gi}: type ${type}`);
    return new THREE.BoxGeometry(0.06, 0.06, 0.06);
  }

  /** (Re)build all geom meshes from the current model. Called on model load. */
  rebuild(engine: any): void {
    this.clearModelObjects();
    this.unsupported = [];
    const m = engine.model;
    const mj = engine.mujoco;
    const rgba = m.geom_rgba;
    for (let gi = 0; gi < (m.ngeom as number); gi++) {
      const geo = this.geomGeometry(engine, gi);
      const o4 = gi * 4;
      const mat = new THREE.MeshStandardMaterial({
        color: this.unsupported.some(item => item.startsWith(`geom ${gi}:`)) ? new THREE.Color(0xff00aa) : new THREE.Color(rgba[o4], rgba[o4 + 1], rgba[o4 + 2]),
        transparent: (rgba[o4 + 3] as number) < 0.999,
        opacity: rgba[o4 + 3] as number,
        roughness: 0.5,
        metalness: 0.08,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if ((m.geom_type[gi] as number) === mj.mjtGeom.mjGEOM_ELLIPSOID.value) {
        const o = gi * 3;
        mesh.scale.set(
          (m.geom_size[o] as number) || 1,
          (m.geom_size[o + 1] as number) || 1,
          (m.geom_size[o + 2] as number) || 1,
        );
      }
      this.geomGroup.add(mesh);
      this.geomMeshes.push(mesh);
    }
    const nsite = (m.nsite as number) || 0;
    if (nsite > 0) {
      const sg = new THREE.SphereGeometry(0.016, 10, 8);
      const sm = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
      for (let i = 0; i < nsite; i++) {
        const mesh = new THREE.Mesh(sg, sm);
        this.siteGroup.add(mesh);
        this.siteMeshes.push(mesh);
      }
    }
    this.jointLines.geometry.dispose();
    this.jointLines.geometry = new THREE.BufferGeometry();
    this.jointLines.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array((m.njnt as number) * 6), 3));
  }

  private clearModelObjects(): void {
    const geometries = new Set<THREE.BufferGeometry>(this.meshCache.values());
    const materials = new Set<THREE.Material>();
    for (const group of [this.geomGroup, this.siteGroup]) {
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry);
          const list = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of list) materials.add(material);
        }
      });
      group.clear();
    }
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    this.meshCache.clear(); // Mesh IDs are local to each newly compiled model.
    this.geomMeshes = [];
    this.siteMeshes = [];
  }

  /** Push current physics state into the three.js objects. */
  sync(engine: any, opts: ViewOpts): void {
    if (!engine.ready) return;
    const m = engine.model;
    const d = engine.data;
    const n = m.ngeom as number;
    if (this.geomMeshes.length !== n) this.rebuild(engine);
    const xp = d.geom_xpos as ArrayLike<number>;
    const xm = d.geom_xmat as ArrayLike<number>;
    for (let i = 0; i < n && i < this.geomMeshes.length; i++) {
      const mesh = this.geomMeshes[i];
      mesh.position.set(xp[i * 3], xp[i * 3 + 1], xp[i * 3 + 2]);
      const o = i * 9;
      this.tmpM.set(
        xm[o], xm[o + 1], xm[o + 2], 0,
        xm[o + 3], xm[o + 4], xm[o + 5], 0,
        xm[o + 6], xm[o + 7], xm[o + 8], 0,
        0, 0, 0, 1,
      );
      mesh.quaternion.setFromRotationMatrix(this.tmpM);
    }
    if (opts.sites && this.siteMeshes.length > 0) {
      this.siteGroup.visible = true;
      const sxp = d.site_xpos as ArrayLike<number>;
      const sxm = d.site_xmat as ArrayLike<number>;
      for (let i = 0; i < this.siteMeshes.length; i++) {
        const mesh = this.siteMeshes[i];
        mesh.position.set(sxp[i * 3], sxp[i * 3 + 1], sxp[i * 3 + 2]);
        const o = i * 9;
        this.tmpM.set(
          sxm[o], sxm[o + 1], sxm[o + 2], 0,
          sxm[o + 3], sxm[o + 4], sxm[o + 5], 0,
          sxm[o + 6], sxm[o + 7], sxm[o + 8], 0,
          0, 0, 0, 1,
        );
        mesh.quaternion.setFromRotationMatrix(this.tmpM);
      }
    } else {
      this.siteGroup.visible = false;
    }
    if (opts.contacts) {
      let cv: any = null;
      try {
        cv = d.contact;
        const ncon = d.ncon as number;
        const cnt = Math.min(ncon, MAX_CONTACTS);
        for (let i = 0; i < cnt; i++) {
          const c = cv.get(i);
          try {
            const p = c.pos as ArrayLike<number>;
            this.tmpM.makeTranslation(p[0], p[1], p[2]);
            this.contactMesh.setMatrixAt(i, this.tmpM);
          } finally {
            c?.delete?.();
          }
        }
        this.contactMesh.count = cnt;
        this.contactMesh.instanceMatrix.needsUpdate = true;
      } catch {
        this.contactMesh.count = 0;
      } finally {
        cv?.delete?.();
      }
    } else {
      this.contactMesh.count = 0;
    }
    if (opts.jointAxes && (m.njnt as number) > 0) {
      const xa = d.xanchor as ArrayLike<number>;
      const xs = d.xaxis as ArrayLike<number>;
      const nj = m.njnt as number;
      const positions = this.jointLines.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = positions.array as Float32Array;
      for (let j = 0; j < nj; j++) {
        const o = j * 3;
        arr[j * 6] = xa[o];
        arr[j * 6 + 1] = xa[o + 1];
        arr[j * 6 + 2] = xa[o + 2];
        arr[j * 6 + 3] = xa[o] + (xs[o] as number) * 0.18;
        arr[j * 6 + 4] = xa[o + 1] + (xs[o + 1] as number) * 0.18;
        arr[j * 6 + 5] = xa[o + 2] + (xs[o + 2] as number) * 0.18;
      }
      positions.needsUpdate = true;
      this.jointLines.visible = true;
    } else {
      this.jointLines.visible = false;
    }
    this.grid.visible = opts.grid;
    const config=engine.controlRecord;
    this.targetMarker.visible = /model=["']contact_arm["']/.test(engine.xml) && config?.mode === 'feedback';
    if(this.targetMarker.visible) {
      const [a,b]=config.target;
      this.targetMarker.position.set(0.55*Math.cos(a)+0.45*Math.cos(a+b),0.55*Math.sin(a)+0.45*Math.sin(a+b),0.34);
    }
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.targetMarker.geometry.dispose();
    this.targetMarker.material.dispose();
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.clearModelObjects();
    this.contactMesh.geometry.dispose();
    (this.contactMesh.material as THREE.Material).dispose();
    this.contactMesh.dispose();
    this.jointLines.geometry.dispose();
    (this.jointLines.material as THREE.Material).dispose();
    this.grid.geometry.dispose();
    const gridMaterials = Array.isArray(this.grid.material) ? this.grid.material : [this.grid.material];
    for (const material of gridMaterials) material.dispose();
    this.scene.traverse((object) => {
      if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
