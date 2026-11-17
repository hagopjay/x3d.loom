// Execute actual Node controls, retain a scoped report, preserve historical receipts.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const canonical = value => JSON.stringify(value);
function sourceIdentity() {
  const names = ['build.mjs','package.json','package-lock.json',
    ...fs.readdirSync(path.join(root,'src')).map(n=>'src/'+n),
    ...fs.readdirSync(path.join(root,'test')).filter(n=>n.endsWith('.mjs')||n==='limits.json').map(n=>'test/'+n),
    'vendor/three/ORIGIN.json','vendor/x3d_mcp/ORIGIN.json','tools/check_release.mjs'];
  return Object.fromEntries(names.sort().map(n=>[n,hash(fs.readFileSync(path.join(root,n)))]));
}
const started = new Date().toISOString(), identity = sourceIdentity();
const historical = ['receipts/gates.json','receipts/hashes-node.json'];
const saved = new Map(historical.map(n=>[n,fs.readFileSync(path.join(root,n))]));
const report = {schema:'floplab.release-checks/1', edition:'showtime', started_utc:started,
  environment:{node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model||'unknown'},
  source_sha256:identity, tests:[], status:'not_run',
  limits:{path:'test/limits.json',sha256:identity['test/limits.json'],scope:'Inherited authored physics limits retained unchanged from the supplied committed fold-back baseline; historical bars are not retroactively precommitted.'},
  limitations:['One Node executor; no fresh browser cross-host comparison, real GPU, gamepad, mobile hardware or formal Loom acceptance in this command.','Pose fingerprints cover poses only. Ghosts and history review are not full-state checkpoints.','Historical receipts are restored after testing; fresh numerical gate results are retained in this report.']};
let failed = false;
try {
  for(const name of ['core.test.mjs','gates.test.mjs','expedition.test.mjs','expedition-integration.test.mjs','x3dio.test.mjs','x3dio-dom.test.mjs','recipes.test.mjs','new-controls.state-scope.mjs','showtime.test.mjs','showtime-integration.test.mjs','carnival.test.mjs','presentation.test.mjs']) {
    const start = performance.now(), result=spawnSync(process.execPath,['test/'+name],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
    report.tests.push({path:'test/'+name,exit_code:result.status,duration_ms:+(performance.now()-start).toFixed(3),stdout:result.stdout||'',stderr:result.stderr||'',instrument_error:result.error?.message||null});
    console.log((result.status===0?'PASS ':'FAIL ')+name);
    if(result.status!==0) failed=true;
    if(name==='gates.test.mjs'&&result.status===0) report.physics_gates=JSON.parse(fs.readFileSync(path.join(root,'receipts/gates.json'),'utf8'));
  }
  report.source_drift = canonical(sourceIdentity())===canonical(identity) ? 'none' : 'changed';
  if(report.source_drift!=='none') failed=true;
  report.status=failed?'fail':'pass';
} finally {
  for(const [name,bytes] of saved) fs.writeFileSync(path.join(root,name),bytes);
  report.finished_utc=new Date().toISOString();
  report.report_sha256=hash(Buffer.from(canonical(report)));
  fs.writeFileSync(path.join(root,'receipts/showtime-checks.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({status:report.status,suites:report.tests.length,physics_gates:report.physics_gates?.gates.filter(g=>g.pass).length,controls_caught:report.physics_gates?.controls.filter(g=>g.caught===true).length,source_drift:report.source_drift}));
process.exitCode=failed?1:0;
