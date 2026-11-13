// Messages between the main thread and the PhysX worker. State and contacts travel as transferable buffers (no SharedArrayBuffer, so no COOP/COEP needed).
import type { Quat, SceneModel, Vec3 } from './model.ts';
import type { BuildNote, WorldOptions } from './world.ts';

export type ToWorker =
  | { t: 'build'; id: number; model: SceneModel; opts: WorldOptions }
  | { t: 'step'; id: number; n: number; hash: boolean; targets: { index: number; p: Vec3; q: Quat }[]; paths: { index: number; p: number[]; q: number[] }[]; teleports: { index: number; p: Vec3; q: Quat; v: Vec3; w: Vec3 }[]; sets: SetField[] };

/**
 * set_field command, applied before the next step: a live input of a joint or a body; a joint removed from RigidBodyCollection.joints
 * ('jointRemove'); RigidBodyCollection.gravity ('gravity', index = collection); CollidableShape.enabled ('shape', value 1 or 0); HAnimJoint.stiffness ('stiffness', index = the link's body index); a page's one-off impulse ('impulse', N·s at the centre of mass: not an X3D field, like teleports).
 */
export interface SetField { kind: 'joint' | 'body' | 'jointRemove' | 'gravity' | 'shape' | 'stiffness' | 'impulse'; index: number; field: string; value: number | Vec3 }

export type FromWorker =
  | { t: 'ready'; version: string; loadMs: number }
  | { t: 'built'; id: number; notes: BuildNote[]; bodyCount: number; jointCount: number; buildMs: number; bounceThreshold: number }
  | { t: 'state'; id: number; stepCount: number; time: number; state: Float64Array; joints: Float64Array; contacts: Float32Array; events: Float32Array; contactsDropped: number; hashes: number[]; physicsMs: number; n: number }
  | { t: 'error'; id: number; message: string };
