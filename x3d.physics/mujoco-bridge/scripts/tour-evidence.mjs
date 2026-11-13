// Distil the validation records into the small summary the guided tour shows (src/data/evidence.json).
// Only counts, versions and dates leave validation/: no local paths, no reports.
// Run by `npm run vendor` (so every build shows the numbers of the records it was built with).
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const read=f=>JSON.parse(readFileSync(f,'utf8'));
const pass=c=>c.status==='pass'||c.status==='passed'||c.passed===true||c.ok===true;
const suites=['runtime','workbench','ui-dom','bridge','bridge-ui'].map(n=>{const d=read(`validation/${n}-results.json`);return {name:n,passed:d.checks.filter(pass).length,total:d.checks.length};});
const threats=read('validation/importer-threat-results.json');
const smoke=read('validation/browser-smoke-results.json');
const browsers=['chromium','firefox','webkit'].map(b=>{
 const ev=existsSync(`validation/browser-smoke/${b}/evidence.json`)?read(`validation/browser-smoke/${b}/evidence.json`):{};
 const tests=smoke.tests.filter(t=>t.project===b);
 return {name:b,label:{chromium:'Chromium',firefox:'Firefox',webkit:'WebKit (Safari)'}[b],version:ev.version??null,passed:tests.filter(t=>t.status==='passed').length,total:tests.length};
});
const schema=read('validation/x3d-schema-results.json');
const before=read('validation/x3d-mcp-results.before-fix.json'),after=read('validation/x3d-mcp-results.json');
const out={
 generatedAt:new Date().toISOString().slice(0,10),
 nodeChecks:{passed:suites.reduce((a,s)=>a+s.passed,0),total:suites.reduce((a,s)=>a+s.total,0)},
 threats:{passed:threats.passed,total:threats.checks.length,defended:threats.checks.filter(c=>c.kind==='defended').length,gaps:threats.checks.filter(c=>c.kind==='gap').length},
 browsers,
 schema:{passed:schema.checks.filter(pass).length,total:schema.checks.length},
 secondValidator:{scenes:before.records.length,errorsBefore:before.records.map(r=>r.semantic.errors),errorsAfter:after.records.map(r=>r.semantic.errors)},
 // Measured once and recorded in GATE-0.md and AGENTS-SLICE.md (not recomputed at build time):
 recorded:{buildByteIdentical:'2026-11-05',nativeVsBrowserMaxRad:6e-16,nativeVsBrowserDate:'2026-11-06'},
};
writeFileSync('src/data/evidence.json',JSON.stringify(out,null,1)+'\n');
console.log(`tour evidence: ${out.nodeChecks.passed}/${out.nodeChecks.total} node checks, ${out.threats.passed}/${out.threats.total} threat checks, browsers ${browsers.map(b=>`${b.name} ${b.passed}/${b.total}`).join(', ')}`);
