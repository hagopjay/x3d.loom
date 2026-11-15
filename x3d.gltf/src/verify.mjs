// verify(sourceBytes, outputBytes, profile): the gates a profile's contract is checked against. Nothing here renders; the render oracle lives in render/.
//   validator  Khronos validator on the delivered file and, for compressed files, on the decoded canonical file (validate.mjs)
//   identity   multiset of x3d_* / name / extras tokens, source against output (identity.mjs)
//   geometry   triangle count, area, bounds, nearest-centroid deviation, normals, uv (geometry.mjs)
//   materials  look-defining material fields (materials.mjs)
//   animation  channels, key times, values (animation.mjs)
import { makeIO } from './io.mjs';
import { PROFILES } from './profiles.mjs';
import { compareDocs } from './gates.mjs';
import { validateDelivery, validateBytes } from './validate.mjs';
import { ktx2Images } from './ktx2check.mjs';
import { byteBreakdown, inventory } from './measure.mjs';
import { transferSizes } from './transfer.mjs';

export async function loadDoc(bytes) { const io = await makeIO(); return io.readBinary(new Uint8Array(bytes)); }

export async function verify(sourceBytes, outputBytes, profileId, { maxWarnings = null } = {}) {
  const profile = PROFILES[profileId];
  const io = await makeIO();
  const [srcDoc, outDoc] = await Promise.all([loadDoc(sourceBytes), loadDoc(outputBytes)]);
  const t0 = performance.now(), timing = {};
  const lap = (k) => { timing[k] = Math.round(performance.now() - t0); };

  const srcVal = await validateBytes(sourceBytes, { uri: 'source.glb' });
  const outVal = await validateDelivery(outputBytes, { maxWarnings });
  lap('validate');
  const g = await compareDocs({ srcDoc, outDoc, srcBytes: sourceBytes, outBytes: outputBytes, io, contract: profile });
  lap('gates');

  const failures = [...g.failures];
  const canon = outVal.canonical || outVal.delivered;
  if (!outVal.ok) failures.unshift(`validator: delivered ${outVal.delivered.numErrors} errors${outVal.canonical ? `, canonical ${outVal.canonical.numErrors} errors` : ''}`);
  if (canon.unexplainedWarnings > srcVal.unexplainedWarnings) failures.push(`validator: ${canon.unexplainedWarnings} unexplained warnings against ${srcVal.unexplainedWarnings} in the source`);
  const ktx = ktx2Images(outDoc);
  for (const k of ktx) if (!k.ok) failures.push(`ktx2: ${k.name || 'image'}: ${k.problems.join('; ')}`);

  const inv = { source: inventory(srcDoc), output: inventory(outDoc) }, id = g.id;
  return {
    profile: profileId, ok: failures.length === 0, failures, notes: g.notes, timingMs: timing,
    validator: { source: pickVal(srcVal), delivered: pickVal(outVal.delivered), canonical: outVal.canonical ? pickVal(outVal.canonical) : null, note: outVal.note },
    identity: { sourceTokens: id.sourceTokens, outputTokens: id.outputTokens, preserved: id.preserved, lost: id.lost.length, added: id.added.length, lostByKind: g.lostByKind, taggedLost: id.taggedLost, defPath: id.defPath, lostSample: id.lost.slice(0, 5), addedSample: id.added.slice(0, 5) },
    geometry: g.geo, materials: g.mat, animation: g.anim, inventory: inv, ktx2: ktx,
    bytes: { source: { ...byteBreakdown(Buffer.from(sourceBytes)), transfer: transferSizes(Buffer.from(sourceBytes)) }, output: { ...byteBreakdown(Buffer.from(outputBytes)), transfer: transferSizes(Buffer.from(outputBytes)) } },
  };
}
const pickVal = (v) => ({ errors: v.numErrors, warnings: v.numWarnings, explainedWarnings: v.explainedWarnings, unexplainedWarnings: v.unexplainedWarnings, infos: v.numInfos, hints: v.numHints, ok: v.ok, validatorVersion: v.validatorVersion, extensionsUsed: v.extensionsUsed, extensionsRequired: v.extensionsRequired, extensionsNotValidated: v.extensionsNotValidated, triangles: v.totalTriangleCount, issues: v.issues.slice(0, 10) });
