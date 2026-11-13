import JSZip from 'jszip';
import {PROTOCOL,PROFILE,parseRecipe,parseTarget,type Recipe,type Frame} from './contract';
import {createScene,manifest,readScene} from './scene';
import {compileRecipe} from './model';
export async function exportBundle(recipe:Recipe,target:[number,number],frame:Frame,events:unknown,trial:unknown){
 const zip=new JSZip();
 zip.file('manifest.json',JSON.stringify(manifest(recipe,target),null,2));
 zip.file('x3d/scene.x3d',createScene(recipe,target,frame));zip.file('mjcf/model.xml',compileRecipe(recipe));
 zip.file('records/observation.json',JSON.stringify(frame,null,2));zip.file('records/commands.json',JSON.stringify(events,null,2));
 if(trial)zip.file('records/trial.json',JSON.stringify(trial,null,2));
 zip.file('README.txt','X3D↔MuJoCo experimental contact-arm/1 package.\nOpen x3d/scene.x3d in an X3D browser for a standard visual snapshot and drag behavior.\nImport this ZIP into the prototype to compile the supported physical annotations.\nImport resets physics to home; records are observations, not restart checkpoints.\nSee manifest.json for supported mappings, coordinate conventions and losses.\n');
 return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
export async function importBundle(bytes:ArrayBuffer):Promise<{recipe:Recipe;target:[number,number];warnings:string[]}>{
 if(bytes.byteLength>2000000)throw Error('Experiment package import limit is 2 MB');
 const zip=await JSZip.loadAsync(bytes);const expected=['manifest.json','x3d/scene.x3d','mjcf/model.xml'];
 for(const n of expected)if(!zip.file(n))throw Error(`Missing package member ${n}`);
 // Reject excessive declared uncompressed sizes before decompressing user input.
 let total=0;
 for(const file of Object.values(zip.files)){
  if(file.dir)continue;
  const size=(file as unknown as {_data?:{uncompressedSize?:number}})._data?.uncompressedSize;
  if(typeof size!=='number'||size>5000000||(total+=size)>12000000)throw Error('Package member exceeds the bounded prototype import profile');
 }
 const m=JSON.parse(await zip.file('manifest.json')!.async('string'));
 if(m.protocol!==PROTOCOL||m.profile!==PROFILE)throw Error('Unsupported package profile');
 const parsed=readScene(await zip.file('x3d/scene.x3d')!.async('string'));
 if(JSON.stringify(parseRecipe(m.recipe))!==JSON.stringify(parsed.recipe)||JSON.stringify(parseTarget(m.target))!==JSON.stringify(parsed.target))throw Error('Manifest and X3D physical annotations disagree. Import the edited X3D directly to normalize it.');
 const xml=await zip.file('mjcf/model.xml')!.async('string');if(xml!==compileRecipe(parsed.recipe))throw Error('MJCF is inconsistent with the declared physical profile');
 return parsed;
}
