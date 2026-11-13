import { loadPhysX } from './loadphysx.mjs';
const P = await loadPhysX();
const v = P.PHYSICS_VERSION; const F = P.CreateFoundation(v, new P.PxDefaultAllocator(), new P.PxDefaultErrorCallback());
const tol = new P.PxTolerancesScale(); const phys = P.CreatePhysics(v, F, tol);
const pf = P.PxPairFlagEnum;
function run(ccd, speed, dt, x0, offset) {
  const sd = new P.PxSceneDesc(tol); sd.gravity = new P.PxVec3(0,0,0);
  sd.cpuDispatcher = P.DefaultCpuDispatcherCreate(0);
  const fs = new P.PassThroughFilterShaderImpl();
  const flags = pf.eSOLVE_CONTACT | pf.eDETECT_DISCRETE_CONTACT | pf.eDETECT_CCD_CONTACT | pf.eNOTIFY_TOUCH_FOUND | pf.eNOTIFY_CONTACT_POINTS;
  fs.filterShader = () => { fs.set_outputPairFlags(flags); return 0; };
  P.setupPassThroughFilterShader(sd, fs);
  if (ccd) sd.flags.raise(P.PxSceneFlagEnum.eENABLE_CCD);
  const scene = phys.createScene(sd);
  const mat = phys.createMaterial(0.5,0.5,0);
  const sf = new P.PxShapeFlags(P.PxShapeFlagEnum.eSCENE_QUERY_SHAPE | P.PxShapeFlagEnum.eSIMULATION_SHAPE);
  const wall = phys.createShape(new P.PxBoxGeometry(0.0025,0.1,0.1), mat, true, sf); wall.setContactOffset(offset); wall.setRestOffset(0);
  const st = phys.createRigidStatic(new P.PxTransform(new P.PxVec3(0.5,0,0), new P.PxQuat(0,0,0,1))); st.attachShape(wall); scene.addActor(st);
  const ball = phys.createShape(new P.PxSphereGeometry(0.008), mat, true, sf); ball.setContactOffset(offset); ball.setRestOffset(0);
  const b = phys.createRigidDynamic(new P.PxTransform(new P.PxVec3(x0,0,0), new P.PxQuat(0,0,0,1))); b.attachShape(ball);
  P.PxRigidBodyExt.prototype.setMassAndUpdateInertia(b, 0.005);
  if (ccd) b.setRigidBodyFlag(P.PxRigidBodyFlagEnum.eENABLE_CCD, true);
  b.setLinearVelocity(new P.PxVec3(speed,0,0));
  scene.addActor(b);
  for (let i=0;i<Math.ceil(1.2/speed/dt)+5;i++){ scene.simulate(dt); scene.fetchResults(true); }
  const x = b.getGlobalPose().p.x; scene.release();
  return x > 0.5;
}
for (const [speed, dt] of [[5,1/240],[5,1/60],[20,1/240],[50,1/240]]) for (const off of [0.02, 0.001]) {
  let t0=0,t1=0; const N=50;
  for (let k=0;k<N;k++){ const x0 = -speed*dt*k/N; if (run(false,speed,dt,x0,off)) t0++; if (run(true,speed,dt,x0,off)) t1++; }
  console.log(`v=${speed} dt=1/${Math.round(1/dt)} contactOffset=${off}: tunnelled without CCD ${t0}/${N}, with CCD ${t1}/${N}`);
}
