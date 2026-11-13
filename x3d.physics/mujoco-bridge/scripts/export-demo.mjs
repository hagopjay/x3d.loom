import {writeFile} from 'node:fs/promises';
import {MuJoCoEngine} from '../src/mujoco/engine.ts';
import {ARM} from '../src/data/arm.ts';
import {measureTrial,trialCsv} from '../src/mujoco/trials.ts';
const e=new MuJoCoEngine();await e.init();e.loadXML(ARM.xml);
try{
 const run=await measureTrial(e,{mode:'feedback',manual:[],target:[.35,.6]});
 await writeFile('examples/contact-arm-trial.json',JSON.stringify({run,baseline:null},null,2));
 await writeFile('examples/contact-arm-trial.csv',trialCsv(run));
 console.log(JSON.stringify(run.metrics));
}finally{e.dispose();}
