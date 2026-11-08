/* Gobbler demiurge on Babylon WebGPU: reader additions for the nodes the Demiurge scene has on top of Gobbler 3 Deep. Concatenated after gobbler/reader-ext.js in the same
   bundle scope (DEFS, FLAT, CONTAINER, IO, IN, OUT, INIT, GROUP and R are visible). Entries are only added; nothing that parses today parses differently.
     LOD                 children are the levels, range[] the switch distances, measured in the LOD's own frame
     HAnimHumanoid       a Transform whose skeleton (the joint tree) and skin (the bodies) are drawn; joints, segments, sites and viewpoints are lists of USE references, not drawn twice
     HAnimJoint/Segment/Site   a Transform (the joint rotates about its centre)
     ProximitySensor     the box test and the camera pose are the body's (body-dm.js); the page uses a huge one to read the camera
     Inline              url + load; the body fetches, parses and adopts the file when load turns true */

FLAT['HAnimJoint.skinCoordIndex'] = Int32Array; FLAT['HAnimJoint.skinCoordWeight'] = Float32Array;

const _xf = { translation: ['SFVec3f', IO, [0, 0, 0]], rotation: ['SFRotation', IO, [0, 0, 1, 0]], scale: ['SFVec3f', IO, [1, 1, 1]],
              scaleOrientation: ['SFRotation', IO, [0, 0, 1, 0]], center: ['SFVec3f', IO, [0, 0, 0]] };
Object.assign(DEFS, {
  LOD: { ...GROUP, range: ['MFFloat', INIT, []], center: ['SFVec3f', INIT, [0, 0, 0]], forceTransitions: ['SFBool', INIT, false] },
  HAnimJoint: { ...GROUP, ..._xf, name: ['SFString', IO, ''], skinCoordIndex: ['MFInt32', IO, []], skinCoordWeight: ['MFFloat', IO, []], displacements: ['MFNode', IO, []],
                llimit: ['MFFloat', IO, []], ulimit: ['MFFloat', IO, []], limitOrientation: ['SFRotation', IO, [0, 0, 1, 0]] },
  HAnimSegment: { ...GROUP, name: ['SFString', IO, ''], coord: ['SFNode', IO, null], displacers: ['MFNode', IO, []], mass: ['SFFloat', IO, 0], centerOfMass: ['SFVec3f', IO, [0, 0, 0]] },
  HAnimSite: { ...GROUP, ..._xf, name: ['SFString', IO, ''] },
  HAnimHumanoid: { ...GROUP, ..._xf, name: ['SFString', IO, ''], version: ['SFString', INIT, ''], skeletalConfiguration: ['SFString', INIT, ''], info: ['MFString', IO, []],
                   skeleton: ['MFNode', IO, []], skin: ['MFNode', IO, []], skinCoord: ['SFNode', IO, null], skinNormal: ['SFNode', IO, null],
                   joints: ['MFNode', IO, []], segments: ['MFNode', IO, []], sites: ['MFNode', IO, []], viewpoints: ['MFNode', IO, []], skeletonConfig: ['SFString', IO, ''] },
  ProximitySensor: { center: ['SFVec3f', IO, [0, 0, 0]], size: ['SFVec3f', IO, [0, 0, 0]], enabled: ['SFBool', IO, true], isActive: ['SFBool', OUT, false],
                     position_changed: ['SFVec3f', OUT, [0, 0, 0]], orientation_changed: ['SFRotation', OUT, [0, 0, 1, 0]], centerOfRotation_changed: ['SFVec3f', OUT, [0, 0, 0]],
                     enterTime: ['SFTime', OUT, 0], exitTime: ['SFTime', OUT, 0] },
  Inline: { url: ['MFString', IO, []], load: ['SFBool', IO, true], bboxCenter: ['SFVec3f', INIT, [0, 0, 0]], bboxSize: ['SFVec3f', INIT, [-1, -1, -1]] },
});
for (const t of ['HAnimJoint', 'HAnimSegment', 'HAnimSite', 'HAnimHumanoid', 'LOD']) DEFS[t].metadata = ['SFNode', IO, null];
// the humanoid's list fields hold USE references; Coordinate and Normal inside it are the shared skin points
Object.assign(CONTAINER, {});

/* TimeSensor pauseTime and resumeTime (19775-1 8.4.6 rule: paused while pauseTime > resumeTime and pauseTime <= now). The page freezes the bird's Sway for the dive to the village and
   resumes it on the way out; the brain reader has no pause. While paused no event leaves the sensor; on resume the clock carries on from where it stopped (start time shifted by the pause). */
const _tickDM = tickTimeSensor;
tickTimeSensor = function (n, now) {
  const f = n.f, st = n.state || (n.state = { active: false, cycle: -1 });
  // a looping sensor whose startTime was never set starts when the world does (X_ITE counts its elapsedTime from there, not from 1970: a shader that adds time * 0.1 to a noise
  // coordinate would otherwise see 1.8e8 and lose every digit it needs)
  if (!st.active && !st.paused && f.loop && f.enabled && f.startTime === 0 && !st.t0) { st.t0 = now; f.startTime = now; }
  if (st.active || st.paused) {
    if (!st.paused && f.pauseTime > f.resumeTime && now >= f.pauseTime) { st.paused = true; st.pAt = f.pauseTime; f.isPaused = true; events.emit(n, 'isPaused', true); }
    else if (st.paused && f.resumeTime >= f.pauseTime && now >= f.resumeTime) { st.shift = (st.shift || 0) + (f.resumeTime - st.pAt); st.paused = false; f.isPaused = false; events.emit(n, 'isPaused', false); }
    if (st.paused) return;
  }
  return _tickDM(n, now - (st.shift || 0));
};
R.tickTimeSensor = tickTimeSensor;
