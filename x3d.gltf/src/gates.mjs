// The portable half of verification: everything that needs only two glTF-Transform Documents (no validator, no zlib), so the same code runs in Node and
// in the browser bundle behind the demo. verify.mjs adds the Node-only gates (Khronos validator, KTX2 container, transfer sizes) on top.
import { boundsForGeometry } from './profile-contract.mjs';
import { snapshot, diffIdentity, lostByKind } from './identity.mjs';
import { collectGeometry, compareGeometry } from './geometry.mjs';
import { animationSummary, compareAnimation } from './animation.mjs';
import { materialTable, compareMaterials } from './materials.mjs';

export async function compareDocs({ srcDoc, outDoc, srcBytes, outBytes, io, contract }) {
  const id = diffIdentity(snapshot(srcDoc), snapshot(outDoc));
  const geo = compareGeometry(collectGeometry(srcDoc), collectGeometry(outDoc));
  const mat = compareMaterials(await materialTable(srcBytes, io), await materialTable(outBytes, io));
  const anim = compareAnimation(animationSummary(srcDoc), animationSummary(outDoc));
  const bound = boundsForGeometry(contract.geometry), failures = [], notes = [];
  if (contract.identity === 'exact' && !id.exact) failures.push(`identity: exact profile lost ${id.lost.length} and added ${id.added.length} tokens`);
  if (contract.identity === 'mapped' && id.lost.length) failures.push(`identity: mapped profile lost ${id.lost.length} tokens`);
  // Exact profiles may not change a single triangle. Quantizing profiles may collapse triangles smaller than the grid step (lumen.glb: 8 of 93k at 14 bits)
  // or, with Draco, drop the zero-area ones; that is reported, bounded (0.1% of the triangles, at least 16) and backed by the area and centroid gates below.
  const lostSolid = -geo.solidDelta;
  if (bound.bits == null) { if (geo.solidDelta !== 0 || geo.triangleDelta !== 0) failures.push(`geometry: exact profile changed triangles (${geo.triangleDelta} total, ${geo.solidDelta} non-degenerate)`); }
  else {
    if (geo.solidDelta > 0) failures.push(`geometry: ${geo.solidDelta} more non-degenerate triangles than the source`);
    if (lostSolid > Math.max(16, 0.001 * geo.sourceSolid)) failures.push(`geometry: ${lostSolid} triangles collapsed (more than 0.1% of ${geo.sourceSolid})`);
    else if (lostSolid > 0) notes.push(`${lostSolid} triangles collapsed below the quantization step`);
  }
  if (geo.degenerateDropped > 0) notes.push(`${geo.degenerateDropped} zero-area triangles were dropped by the encoder`);
  if (geo.centroid && geo.centroid.unmatched) failures.push(`geometry: ${geo.centroid.unmatched} source triangles have no output triangle nearby`);
  if (geo.centroid && geo.centroid.maxRel > bound.relMax) failures.push(`geometry: centroid deviation ${geo.centroid.maxRel.toExponential(2)} of the diagonal exceeds ${bound.relMax.toExponential(2)}`);
  if (geo.boundsMaxCornerDeltaRel > bound.relMax * 2) failures.push(`geometry: bounds moved ${geo.boundsMaxCornerDeltaRel.toExponential(2)} of the diagonal`);
  if (Math.abs(geo.areaRelDelta) > Math.max(bound.relMax * 20, 1e-9)) failures.push(`geometry: surface area changed by ${(geo.areaRelDelta * 100).toFixed(4)}%`);
  const nd = geo.normalDegrees;
  if (nd) {
    if (nd.dropped && contract.identity !== 'lossy') failures.push(`geometry: ${nd.dropped} triangles lost their normals`);
    const nBound = bound.bits ? 1.0 : 1e-3;   // 10-bit quantised normals stay inside 1 degree at the 99th percentile; exact profiles move nothing
    if (nd.compared && nd.p99 > nBound) failures.push(`geometry: normals p99 ${nd.p99.toFixed(3)} degrees exceeds ${nBound}`);
  }
  if (mat.differing.length || mat.source !== mat.output) failures.push(`materials: ${mat.differing.length} differ, ${mat.source} -> ${mat.output}`);
  if (anim.unmatched || anim.channelsSource !== anim.channelsOutput) failures.push(`animation: ${anim.unmatched} source channels unmatched (${anim.channelsSource} -> ${anim.channelsOutput})`);
  if (contract.geometry === 'exact' && anim.maxValueDelta > 0) failures.push(`animation: values moved by ${anim.maxValueDelta} in an exact profile`);
  return { id, geo, mat, anim, failures, notes, lostByKind: lostByKind(id.lost) };
}
