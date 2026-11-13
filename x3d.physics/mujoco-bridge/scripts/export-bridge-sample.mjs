import {mkdir,writeFile} from 'node:fs/promises';
import {BridgeSession} from '../src/bridge/session.ts';
import {createScene,manifest} from '../src/bridge/scene.ts';
import {exportBundle} from '../src/bridge/package.ts';
const s=new BridgeSession();await s.init();
try{
 s.engine.simulate(5,s.engine.controller);const f=s.snapshot();
 await mkdir('samples',{recursive:true});
 await writeFile('samples/contact-arm.x3d',createScene(s.recipe,s.target,f));
 await writeFile('samples/contact-arm.xml',s.engine.xml);
 await writeFile('samples/manifest.json',JSON.stringify(manifest(s.recipe,s.target),null,2));
 await writeFile('samples/contact-arm-experiment.zip',await exportBundle(s.recipe,s.target,f,s.history,null));
 console.log(JSON.stringify({touchN:f.touchN,contacts:f.contacts,profile:s.recipe.profile}));
}finally{s.dispose();}
