import fs from 'fs';
const src = ['core','level','game'].map(f=>fs.readFileSync(new URL('../src/'+f+'.js', import.meta.url),'utf8')).join('\n');
fs.mkdirSync(new URL('../dist/', import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../dist/core.mjs', import.meta.url), src + '\nexport { sin, cos, atan2, hyp, World, KERNEL, KERNEL_SOURCE, compileKernel, PREFABS, newLevel, addPart, editPart, removePart, cloneLevel, defaultLevel, windowLevel, buildWorld, Sim, runTrial, NOINPUT, FEEL, HALLS, DEG, TAU };\n');
