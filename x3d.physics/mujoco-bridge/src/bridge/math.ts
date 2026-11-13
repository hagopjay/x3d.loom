import type {Quat,Vec3} from './contract';
/** Proper basis rotation C: MuJoCo Z-up → X3D Y-up. p_X = C p_M. */
export function mjToX3d([x,y,z]:Vec3):Vec3{return [x,z,-y];}
export function x3dToMj([x,y,z]:Vec3):Vec3{return [x,-z,y];}
/** q_X = C q_M C^-1, stored here as axis-angle for X3D SFRotation. */
export function rotationToX3d(q:Quat):[number,number,number,number]{
 const n=Math.hypot(...q);if(!Number.isFinite(n)||n<1e-12)throw Error('Invalid quaternion');
 let [w,x,y,z]=q.map(v=>v/n);if(w<0){w=-w;x=-x;y=-y;z=-z;}
 const s=Math.hypot(x,y,z);return s<1e-10?[0,1,0,0]:[x/s,z/s,-y/s,2*Math.atan2(s,w)];
}
export function forwardTarget(lengths:[number,number],angles:[number,number]):Vec3{
 const [a,b]=angles,[l1,l2]=lengths;return [l1*Math.cos(a)+l2*Math.cos(a+b),l1*Math.sin(a)+l2*Math.sin(a+b),.34];
}
export function inverseTarget(lengths:[number,number],x:number,y:number):[number,number]{
 const [a,b]=lengths,c=(x*x+y*y-a*a-b*b)/(2*a*b);
 if(c < -1-1e-8||c > 1+1e-8)throw Error('Target is outside arm reach');
 const elbow=Math.acos(Math.max(-1,Math.min(1,c)));
 return [Math.atan2(y,x)-Math.atan2(b*Math.sin(elbow),a+b*Math.cos(elbow)),elbow];
}
